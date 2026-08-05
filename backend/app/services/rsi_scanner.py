import asyncio
import os
import uuid
import json
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.session import async_session
from app.db.models import RSIScannerConfig, RSIScannerLog, Portfolio, User
from app.services.market_data import MarketDataService
from app.quant.indicators import detect_price_action_signals
from app.routes.notifications import send_alert_sms, send_alert_telegram

async def rsi_scanner_loop():
    market_service = MarketDataService()
    print("[RSI Scanner] Background scanner thread started.")
    await asyncio.sleep(15)  # Wait for DB schemas and system to initialize
    
    while True:
        try:
            # 1. Fetch active scan rules
            async with async_session() as session:
                result = await session.execute(
                    select(RSIScannerConfig, User.phone_number)
                    .join(User, RSIScannerConfig.user_id == User.id)
                    .where(RSIScannerConfig.active == True)
                )
                configs = result.all()
                
            if not configs:
                await asyncio.sleep(30)
                continue
                
            # Iterate through each active scanning config
            for config, phone in configs:
                try:
                    today = datetime.now()
                    # Look back 5 days to ensure yfinance fallback returns enough candles for RSI
                    from_date = (today - timedelta(days=5)).strftime("%Y-%m-%d")
                    to_date = (today + timedelta(days=1)).strftime("%Y-%m-%d")
                    
                    timeframe_int = 5
                    if config.timeframe.endswith("m"):
                        try:
                            timeframe_int = int(config.timeframe[:-1])
                        except ValueError:
                            pass
                            
                    # Fetch historical intraday candles
                    candles = await asyncio.to_thread(
                        market_service.get_historical_intraday_candles,
                        config.symbol,
                        interval=timeframe_int,
                        from_date=from_date,
                        to_date=to_date
                    )
                    
                    if not candles or len(candles) < config.rsi_period + 5:
                        continue
                        
                    # Sort candles chronologically
                    candles_sorted = sorted(candles, key=lambda x: x['timestamp'])
                    
                    # Run Price Action + RSI signal detection
                    signals = detect_price_action_signals(
                        candles_sorted,
                        rsi_period=config.rsi_period,
                        rsi_upper=config.rsi_upper,
                        rsi_lower=config.rsi_lower
                    )
                    
                    if not signals:
                        continue
                        
                    # Get the most recent breakout signal
                    latest_sig = signals[-1]
                    sig_time = latest_sig['timestamp']
                    direction = latest_sig['direction']
                    spot = latest_sig['spot_price']
                    rsi_val = latest_sig['rsi_value']
                    
                    # Verify if signal has already been processed and logged
                    async with async_session() as session:
                        check_result = await session.execute(
                            select(RSIScannerLog)
                            .where(RSIScannerLog.user_id == config.user_id)
                            .where(RSIScannerLog.symbol == config.symbol)
                            .where(RSIScannerLog.direction == direction)
                            .where(RSIScannerLog.trigger_time == sig_time)
                        )
                        existing_log = check_result.scalar_one_or_none()
                        
                    if existing_log:
                        continue  # Signal already processed
                        
                    print(f"[RSI Scanner] MATCHED SIGNAL: {config.symbol} {direction} at {sig_time} (Spot: {spot}, RSI: {rsi_val})")
                    
                    # Fetch live option chain to select legs
                    chain = await asyncio.to_thread(market_service.get_option_chain, config.symbol)
                    options = chain.get("options", [])
                    expiry = chain.get("selected_expiry")
                    
                    if not options:
                        print(f"[RSI Scanner] Empty option chain for {config.symbol}, skipping trade.")
                        continue
                        
                    # Sort strikes ascending
                    options_sorted = sorted(options, key=lambda x: x['strike'])
                    
                    # Find closest ATM option strike row
                    diffs = [abs(opt['strike'] - spot) for opt in options_sorted]
                    atm_idx = diffs.index(min(diffs))
                    
                    # Choose leg strike based on moneyness & direction
                    target_idx = atm_idx
                    m = config.moneyness.upper()
                    
                    if direction == 'BULLISH_CE':
                        leg_type = 'C'
                        action = 'BUY'
                        if m in ['OTM', 'OTM1']:
                            target_idx = min(len(options_sorted) - 1, atm_idx + 1)
                        elif m == 'OTM2':
                            target_idx = min(len(options_sorted) - 1, atm_idx + 2)
                        elif m == 'ITM':
                            target_idx = max(0, atm_idx - 1)
                    else:
                        leg_type = 'P'
                        action = 'BUY'
                        if m in ['OTM', 'OTM1']:
                            target_idx = max(0, atm_idx - 1)
                        elif m == 'OTM2':
                            target_idx = max(0, atm_idx - 2)
                        elif m == 'ITM':
                            target_idx = min(len(options_sorted) - 1, atm_idx + 1)
                            
                    selected_opt = options_sorted[target_idx]
                    strike = selected_opt['strike']
                    
                    # Extract CE or PE leg details
                    if leg_type == 'C':
                        leg_raw = selected_opt['CE']
                    else:
                        leg_raw = selected_opt['PE']
                        
                    entry_price = leg_raw.get('lastPrice') or leg_raw.get('ask') or 50.0
                    iv = leg_raw.get('impliedVolatility') or 0.15
                    
                    # Map NSE standard lot sizes
                    lot_multiplier = 1
                    s_upper = config.symbol.upper()
                    if s_upper == "NIFTY":
                        lot_multiplier = 25
                    elif s_upper == "BANKNIFTY":
                        lot_multiplier = 15
                    elif s_upper == "SENSEX":
                        lot_multiplier = 20
                    elif s_upper == "FINNIFTY":
                        lot_multiplier = 25
                        
                    total_qty = config.lot_size * lot_multiplier
                    
                    # Build option leg model structure
                    leg_details = {
                        "id": str(uuid.uuid4()),
                        "strike": strike,
                        "optionType": leg_type,
                        "expiry": expiry,
                        "action": action,
                        "quantity": total_qty,
                        "entryPrice": entry_price,
                        "currentPrice": entry_price,
                        "iv": iv,
                        "status": "ACTIVE",
                        "realizedPnL": 0.0
                    }
                    
                    log_id = str(uuid.uuid4())
                    status_log = "PENDING"
                    
                    # Always execute position to Paper Trade Book on strategy alert trigger
                    status_log = "EXECUTED"
                    async with async_session() as session:
                        new_portfolio = Portfolio(
                            id=str(uuid.uuid4()),
                            user_id=config.user_id,
                            name=f"Paper RSI: {config.symbol} {leg_type}E {today.strftime('%d%b %H:%M')}",
                            symbol=config.symbol,
                            description=f"PA+RSI auto-trade: Spot={spot}, RSI={rsi_val:.1f}, Moneyness={config.moneyness}",
                            legs=[leg_details],  # Store leg list directly in JSON column
                            createdAt=today.isoformat(),
                            marginDeployed=entry_price * total_qty,
                            realizedPnL=0.0,
                            entrySpot=spot,
                            peakProfit=0.0,
                            maxDrawdown=0.0,
                            takeProfit=config.tp_pct,
                            stopLoss=config.sl_pct
                        )
                        session.add(new_portfolio)
                        await session.commit()
                            
                    # Log the signal
                    async with async_session() as session:
                        new_log = RSIScannerLog(
                            id=log_id,
                            user_id=config.user_id,
                            symbol=config.symbol,
                            direction=direction,
                            trigger_time=sig_time,
                            spot_price=spot,
                            rsi_value=rsi_val,
                            option_leg_details=leg_details,  # Store leg dictionary directly
                            status=status_log,
                            realized_pnl=0.0
                        )
                        session.add(new_log)
                        await session.commit()
                        
                    # Notification dispatching
                    currency = "$" if s_upper in ["SPY", "AAPL", "MSFT", "TSLA"] else "₹"
                    direction_label = "🟢 BULLISH CE BREAKOUT" if direction == 'BULLISH_CE' else "🔴 BEARISH PE BREAKDOWN"
                    leg_label = f"{config.symbol} {expiry} {strike} {leg_type}E"
                    
                    msg_text = (
                        f"⚡ RSI Scanner Signal!\n"
                        f"Signal: {direction_label}\n"
                        f"Asset: {config.symbol} (Spot: {currency}{spot})\n"
                        f"RSI: {rsi_val:.2f}\n"
                        f"Leg Option: {leg_label} @ LTP {currency}{entry_price}\n"
                        f"Time: {sig_time}\n"
                        f"Execution: {status_log}"
                    )
                    
                    tg_html = (
                        f"<b>⚡ OptionsOracle RSI Scanner Alert!</b>\n\n"
                        f"🎯 <b>Signal:</b> {'🟢 Bullish CE Breakout' if direction == 'BULLISH_CE' else '🔴 Bearish PE Breakdown'}\n"
                        f"📈 <b>Asset:</b> {config.symbol} (Spot: {currency}{spot})\n"
                        f"📊 <b>RSI Value:</b> {rsi_val:.2f}\n"
                        f"💼 <b>Option Leg:</b> <code>{leg_label}</code> @ LTP {currency}{entry_price}\n"
                        f"⏰ <b>Trigger Time:</b> {sig_time}\n"
                        f"⚙️ <b>Execution:</b> {status_log}"
                    )
                    
                    # Telegram notifications
                    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
                    chat_id = os.getenv("TELEGRAM_CHAT_ID")
                    if bot_token and chat_id:
                        try:
                            await send_alert_telegram(bot_token, chat_id, tg_html)
                        except Exception as ne:
                            print(f"[RSI Scanner] Telegram dispatch error: {ne}")
                            
                    # Twilio SMS notifications
                    if phone:
                        try:
                            await asyncio.to_thread(send_alert_sms, phone, msg_text)
                        except Exception as ne:
                            print(f"[RSI Scanner] SMS dispatch error: {ne}")
                            
                except Exception as config_err:
                    print(f"[RSI Scanner] Error in config symbol {config.symbol}: {config_err}")
                    
        except Exception as loop_err:
            print(f"[RSI Scanner] Main loop execution cycle error: {loop_err}")
            
        await asyncio.sleep(30)  # Sleep for 30 seconds between scans
