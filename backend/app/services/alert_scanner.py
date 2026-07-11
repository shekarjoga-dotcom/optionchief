import asyncio
import os
import math
import random
import numpy as np
import httpx
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import update
from app.db.session import async_session
import uuid
from app.db.models import AlertRule, User, Portfolio, TriggeredAlert
from app.services.market_data import MarketDataService
from app.quant.black_scholes import bs_pricing, bs_greeks, calculate_pop
from app.routes.notifications import TriggerAlertSchema
import json
import time

triggered_alerts_cache = {}

NSE_FO_STOCKS = [
    "RELIANCE", "TCS", "HDFCBANK", "ICICIBANK", "INFY", "BHARTIARTL", "ITC", "LT", "SBIN", "HINDUNILVR", 
    "LTIM", "HCLTECH", "AXISBANK", "ASIANPAINT", "KOTAKBANK", "MARUTI", "SUNPHARMA", "NTPC", "TATAMOTORS", "COALINDIA", 
    "TATASTEEL", "ONGC", "ADANIENT", "JSWSTEEL", "TITAN", "POWERGRID", "M&M", "ULTRACEMCO", "BAJFINANCE", "GRASIM", 
    "HINDALCO", "BPCL", "HEROMOTOCO", "NESTLEIND", "CIPLA", "WIPRO", "ADANIPORTS", "APOLLOHOSP", "DIVISLAB", "TATACONSUM", 
    "DRREDDY", "BAJAJFINSV", "EICHERMOT", "JINDALSTEL", "HDFCLIFE", "SHRIRAMFIN", "INDUSINDBK", "BRITANNIA", "TECHM"
]

def get_currency_symbol_py(symbol: str) -> str:
    sym = symbol.upper()
    if sym in ["SPY", "AAPL", "MSFT", "TSLA", "BTC", "ETH", "SOL", "XRP", "LINK", "AVAX", "LTC", "BNB", "ADA"]:
        return "$"
    return "₹"

# Notification helper for portfolio square-off
async def send_portfolio_squareoff_notification(portfolio, trigger_reason, pnl, phone):
    from app.routes.notifications import send_alert_sms, send_alert_telegram
    timestamp = datetime.now().strftime("%I:%M:%S %p")
    cur = get_currency_symbol_py(portfolio.symbol)
    msg_text = (
        f"🚨 OptionsOracle Position Closed!\n"
        f"Portfolio: {portfolio.name}\n"
        f"Symbol: {portfolio.symbol}\n"
        f"Trigger: {trigger_reason}\n"
        f"Realized PnL: {cur}{pnl}\n"
        f"Time: {timestamp}"
    )
    tg_html = (
        f"<b>🚨 OptionsOracle Position Auto-Closed!</b>\n\n"
        f"💼 <b>Portfolio:</b> {portfolio.name}\n"
        f"📈 <b>Symbol:</b> {portfolio.symbol}\n"
        f"⚡ <b>Trigger:</b> {trigger_reason}\n"
        f"💵 <b>Realized PnL:</b> {cur}{pnl}\n"
        f"⏰ <b>Closed Time:</b> {timestamp}"
    )
    
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if bot_token and chat_id:
        try:
            await send_alert_telegram(bot_token, chat_id, tg_html)
        except Exception as e:
            print(f"[Alert Scanner] Error sending Telegram square-off notification: {e}")
            
    sms_phone = os.getenv("TWILIO_PHONE_NUMBER")
    if sms_phone and phone:
        try:
            await asyncio.to_thread(send_alert_sms, phone, msg_text)
        except Exception as e:
            print(f"[Alert Scanner] Error sending SMS square-off notification: {e}")


# Standard notification trigger function
async def send_notification_alert(rule: AlertRule, scan_res: dict, spot: float, phone: str):
    from app.routes.notifications import trigger_alert
    cur = get_currency_symbol_py(rule.symbol if rule.symbol != "ALL" else scan_res.get("symbol", "NIFTY"))
    max_profit_str = f"{cur}{scan_res['maxProfit']:.2f}" if isinstance(scan_res['maxProfit'], (int, float)) else str(scan_res['maxProfit'])
    max_loss_str = f"{cur}{scan_res['maxLoss']:.2f}" if isinstance(scan_res['maxLoss'], (int, float)) else str(scan_res['maxLoss'])
    
    payload = TriggerAlertSchema(
        strategy_name=scan_res["name"],
        symbol=rule.symbol if rule.symbol != "ALL" else scan_res.get("symbol", "NIFTY"),
        expiry=scan_res["expiry"],
        pop=round(scan_res["pop"], 1),
        max_profit=max_profit_str,
        max_loss=max_loss_str,
        rr_ratio=round(scan_res["rr_ratio"], 1),
        timestamp=datetime.now().strftime("%I:%M:%S %p"),
        channel="telegram" if os.getenv("TELEGRAM_BOT_TOKEN") and os.getenv("TELEGRAM_CHAT_ID") else "web_only",
        phone_number=phone,
        current_pnl=f"{cur}0.00",
        spot_price=spot,
        legs=scan_res.get("legs")
    )
    
    print(f"\n[ALERT MATCHED] Rule {rule.id} matches strategy: {scan_res['name']} | POP: {payload.pop}%")
    try:
        from app.routes.notifications import send_alert_sms, send_alert_telegram
        msg_text = (
            f"🔔 OptionsOracle Alert!\n"
            f"Strategy: {payload.strategy_name}\n"
            f"Symbol: {payload.symbol}\n"
            f"Expiry: {payload.expiry}\n"
            f"POP: {payload.pop}%\n"
            f"Max Loss: {payload.max_loss}\n"
            f"Trigger Time: {payload.timestamp}"
        )
        tg_html = (
            f"<b>🔔 OptionsOracle Scanner Alert!</b>\n\n"
            f"📈 <b>Symbol:</b> {payload.symbol}\n"
            f"📅 <b>Expiry:</b> {payload.expiry}\n"
            f"💼 <b>Strategy:</b> {payload.strategy_name}\n"
            f"🎯 <b>Probability of Profit:</b> {payload.pop}%\n"
            f"⚠️ <b>Max Loss:</b> {payload.max_loss}\n"
            f"💵 <b>Max Profit:</b> {payload.max_profit}\n"
            f"⏰ <b>Triggered:</b> {payload.timestamp}"
        )
        
        bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        chat_id = os.getenv("TELEGRAM_CHAT_ID")
        if bot_token and chat_id:
            await send_alert_telegram(bot_token, chat_id, tg_html)
            
        sms_phone = os.getenv("TWILIO_PHONE_NUMBER")
        if sms_phone and phone:
            await asyncio.to_thread(send_alert_sms, phone, msg_text)
    except Exception as e:
        print(f"[Alert Scanner] Error sending notification: {e}")

def get_legs_hash(legs: list) -> str:
    if not legs:
        return ""
    sorted_legs = sorted(
        legs,
        key=lambda x: (
            str(x.get("expiry") or ""),
            float(x.get("strike") or 0.0),
            str(x.get("optionType") or ""),
            str(x.get("action") or ""),
            int(x.get("quantity") or 1)
        )
    )
    parts = []
    for leg in sorted_legs:
        parts.append(
            f"{leg.get('expiry')}_{leg.get('strike')}_{leg.get('optionType')}_{leg.get('action')}_{leg.get('quantity')}"
        )
    return "|".join(parts)


# Helper to project strategy in python
def project_strategy_py(legs: list, spot_price: float, r: float = 0.05, symbol: str = "") -> dict:
    if not legs:
        return {"pop": 50.0, "maxProfit": 0.0, "maxLoss": 0.0, "netDebitCredit": 0.0, "delta": 0.0, "gamma": 0.0, "theta": 0.0}

    # Calculate net premium to shift the boundaries
    net_premium = 0.0
    for leg in legs:
        if leg.get("optionType") == 'F':
            continue
        sign = 1 if leg["action"] == "SELL" else -1
        net_premium += sign * (leg.get("entryPrice") or 0.0) * leg["quantity"]
    abs_premium = abs(net_premium)

    option_strikes = [l["strike"] for l in legs if l.get("optionType") != 'F' and l.get("strike") is not None]
    
    price_points = option_strikes + [spot_price, spot_price - abs_premium, spot_price + abs_premium]
    min_strike = min(price_points)
    max_strike = max(price_points)
        
    buffer = max(spot_price * 0.03, (max_strike - min_strike) * 0.3)
    min_price = max(1.0, min_strike - buffer)
    max_price = max_strike + buffer
    step = (max_price - min_price) / 100
    
    payoff_curve = []
    for S in np.arange(min_price, max_price + step, step):
        pnl = 0.0
        for leg in legs:
            strike = leg.get("strike") or 0.0
            qty = leg["quantity"]
            entry_price = leg["entryPrice"]
            opt_type = leg["optionType"]
            
            # price at expiry
            if opt_type == 'C':
                expiry_val = max(0.0, S - strike)
            elif opt_type == 'P':
                expiry_val = max(0.0, strike - S)
            elif opt_type == 'F':
                expiry_val = S
            else:
                expiry_val = 0.0
                
            if leg["action"] == "BUY":
                pnl += (expiry_val - entry_price) * qty
            else:
                pnl += (entry_price - expiry_val) * qty
        payoff_curve.append((S, pnl))

    # Find break-evens (sign changes in payoff curve)
    break_evens = []
    for i in range(len(payoff_curve) - 1):
        s1, p1 = payoff_curve[i]
        s2, p2 = payoff_curve[i+1]
        if (p1 <= 0 < p2) or (p2 <= 0 < p1):
            crossover = s1 + (0 - p1) * (s2 - s1) / (p2 - p1)
            break_evens.append(crossover)
            
    # Greeks
    agg_delta = 0.0
    agg_gamma = 0.0
    agg_theta = 0.0
    
    option_legs = [l for l in legs if l.get("optionType") != 'F']
    avg_iv = sum(l.get("iv") or 0.0 for l in option_legs) / len(option_legs) if option_legs else 0.50
    expiry_date = datetime.strptime(legs[0]["expiry"], "%Y-%m-%d")
    days_to_expiry = max(1, (expiry_date - datetime.now()).days)
    T = days_to_expiry / 365.0
    
    for leg in legs:
        if leg["optionType"] == 'F':
            sign = 1 if leg["action"] == "BUY" else -1
            agg_delta += sign * leg["quantity"]
            continue
            
        g = bs_greeks(spot_price, leg["strike"], T, r, leg["iv"], leg["optionType"])
        sign = 1 if leg["action"] == "BUY" else -1
        agg_delta += g["delta"] * sign * leg["quantity"]
        agg_gamma += g["gamma"] * sign * leg["quantity"]
        agg_theta += g["theta"] * sign * leg["quantity"]

    # Net credit/debit
    net_premium = 0.0
    for leg in legs:
        sign = 1 if leg["action"] == "SELL" else -1
        net_premium += sign * leg["entryPrice"] * leg["quantity"]

    # POP Calculation
    pop = 50.0
    if len(break_evens) == 0:
        mid_pnl = payoff_curve[50][1]
        pop = 100.0 if mid_pnl > 0 else 0.0
    elif len(break_evens) == 1:
        be = break_evens[0]
        d1 = (math.log(spot_price / be) + (r + 0.5 * avg_iv**2) * T) / (avg_iv * math.sqrt(T))
        d2 = d1 - avg_iv * math.sqrt(T)
        from scipy.stats import norm
        pnl_above = sum(
            (((max(0.0, (be + spot_price * 0.01) - l["strike"]) if l["optionType"] == 'C' else max(0.0, l["strike"] - (be + spot_price * 0.01))) if l["optionType"] != 'F' else (be + spot_price * 0.01)) - l["entryPrice"]) * l["quantity"] * (1 if l["action"] == "BUY" else -1)
            for l in legs
        )
        is_bullish = pnl_above > 0
        pop = norm.cdf(d2) * 100.0 if is_bullish else norm.cdf(-d2) * 100.0
    else:
        from scipy.stats import norm
        lower_be = min(break_evens)
        upper_be = max(break_evens)
        d1_l = (math.log(spot_price / lower_be) + (r + 0.5 * avg_iv**2) * T) / (avg_iv * math.sqrt(T))
        d2_l = d1_l - avg_iv * math.sqrt(T)
        d1_u = (math.log(spot_price / upper_be) + (r + 0.5 * avg_iv**2) * T) / (avg_iv * math.sqrt(T))
        d2_u = d1_u - avg_iv * math.sqrt(T)
        
        mid_point = (lower_be + upper_be) / 2.0
        mid_pnl = sum(
            (((max(0.0, mid_point - l["strike"]) if l["optionType"] == 'C' else max(0.0, l["strike"] - mid_point)) if l["optionType"] != 'F' else mid_point) - l["entryPrice"]) * l["quantity"] * (1 if l["action"] == "BUY" else -1)
            for l in legs
        )
        profit_inside = mid_pnl > 0
        range_prob = abs(norm.cdf(d2_l) - norm.cdf(d2_u)) * 100.0
        pop = range_prob if profit_inside else (100.0 - range_prob)

    # Max profit / loss at expiration
    candidate_spots = [0.0] + [l["strike"] for l in legs if l.get("strike") is not None] + [spot_price * 3.0]
    payoffs = []
    for S in candidate_spots:
        total_pnl = 0.0
        for leg in legs:
            strike = leg.get("strike") or 0.0
            qty = leg["quantity"]
            entry_price = leg["entryPrice"]
            
            if leg["optionType"] == 'C':
                expiry_val = max(0.0, S - strike)
            elif leg["optionType"] == 'P':
                expiry_val = max(0.0, strike - S)
            elif leg["optionType"] == 'F':
                expiry_val = S
            else:
                expiry_val = 0.0
                
            if leg["action"] == "BUY":
                total_pnl += (expiry_val - entry_price) * qty
            else:
                total_pnl += (entry_price - expiry_val) * qty
        payoffs.append(total_pnl)
        
    net_c_qty = sum(l["quantity"] * (1 if l["action"] == "BUY" else -1) for l in legs if l["optionType"] == 'C')
    net_f_qty = sum(l["quantity"] * (1 if l["action"] == "BUY" else -1) for l in legs if l["optionType"] == 'F')
    
    is_profit_unlimited = (net_c_qty + net_f_qty) > 0
    is_loss_unlimited = (net_c_qty + net_f_qty) < 0
    
    max_profit = 'Unlimited' if is_profit_unlimited else max(payoffs)
    max_loss = 'Unlimited' if is_loss_unlimited else abs(min(0.0, min(payoffs)))

    return {
        "pop": pop,
        "maxProfit": max_profit,
        "maxLoss": max_loss,
        "netDebitCredit": net_premium,
        "delta": agg_delta,
        "gamma": agg_gamma,
        "theta": agg_theta
    }

# Strategies scanner helper
def scan_strategies_py(strategy_type: str, options: list, spot: float, expiry: str) -> list:
    if len(options) < 5:
        return []
        
    sorted_options = sorted(options, key=lambda x: x["strike"])
    strikes = [o["strike"] for o in sorted_options]
    
    # Find ATM strike
    atm_strike = min(strikes, key=lambda s: abs(s - spot))
    atm_idx = strikes.index(atm_strike)
    
    results = []
    
    def get_leg(strike: float, option_type: str, action: str) -> dict:
        row = next((o for o in sorted_options if o["strike"] == strike), None)
        if not row: return None
        contract = row.get("CE") if option_type == 'C' else row.get("PE")
        if not contract: return None
        return {
            "strike": strike,
            "optionType": option_type,
            "expiry": expiry,
            "action": action,
            "quantity": 1.0,
            "entryPrice": contract.get("lastPrice") or contract.get("bid") or 1.0,
            "iv": contract.get("impliedVolatility") or 0.25
        }

    type_upper = strategy_type.upper()
    if type_upper in ["IRON CONDOR", "HEDGED SHORT STRANGLE", "ALL"]:
        wing = 2
        for d_put in range(2, 12):
            for d_call in range(2, 12):
                sp_idx = atm_idx - d_put
                lp_idx = sp_idx - wing
                sc_idx = atm_idx + d_call
                lc_idx = sc_idx + wing
                
                if lp_idx >= 0 and lc_idx < len(strikes):
                    l_put = get_leg(strikes[lp_idx], 'P', 'BUY')
                    s_put = get_leg(strikes[sp_idx], 'P', 'SELL')
                    s_call = get_leg(strikes[sc_idx], 'C', 'SELL')
                    l_call = get_leg(strikes[lc_idx], 'C', 'BUY')
                    
                    if l_put and s_put and s_call and l_call:
                        legs = [l_put, s_put, s_call, l_call]
                        metrics = project_strategy_py(legs, spot)
                        
                        rr = 0.0
                        if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                            rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                        
                        name_prefix = "Hedged Short Strangle" if type_upper == "HEDGED SHORT STRANGLE" else "Iron Condor"
                        results.append({
                            "name": f"{name_prefix} ({strikes[lp_idx]}/{strikes[sp_idx]}/{strikes[sc_idx]}/{strikes[lc_idx]})",
                            "symbol": "",
                            "expiry": expiry,
                            "legs": legs,
                            "pop": metrics["pop"],
                            "maxProfit": metrics["maxProfit"],
                            "maxLoss": metrics["maxLoss"],
                            "rr_ratio": rr,
                            "delta": metrics["delta"],
                            "gamma": metrics["gamma"],
                            "theta": metrics["theta"]
                        })

    if type_upper in ["RATIO IRON CONDOR (1:2)", "ALL"]:
        wing = 2
        for d_put in range(2, 12):
            for d_call in range(2, 12):
                sp_idx = atm_idx - d_put
                lp_idx = sp_idx - wing
                sc_idx = atm_idx + d_call
                lc_idx = sc_idx + (wing * 2)
                
                if lp_idx >= 0 and lc_idx < len(strikes):
                    l_put = get_leg(strikes[lp_idx], 'P', 'BUY')
                    s_put = get_leg(strikes[sp_idx], 'P', 'SELL')
                    s_call = get_leg(strikes[sc_idx], 'C', 'SELL')
                    l_call = get_leg(strikes[lc_idx], 'C', 'BUY')
                    
                    if l_put and s_put and s_call and l_call:
                        l_put = l_put.copy()
                        s_put = s_put.copy()
                        l_put["quantity"] = 2.0
                        s_put["quantity"] = 2.0
                        
                        legs = [l_put, s_put, s_call, l_call]
                        metrics = project_strategy_py(legs, spot)
                        
                        rr = 0.0
                        if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                            rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                        
                        results.append({
                            "name": f"Ratio Iron Condor (1:2) ({strikes[lp_idx]}/{strikes[sp_idx]}/{strikes[sc_idx]}/{strikes[lc_idx]})",
                            "symbol": "",
                            "expiry": expiry,
                            "legs": legs,
                            "pop": metrics["pop"],
                            "maxProfit": metrics["maxProfit"],
                            "maxLoss": metrics["maxLoss"],
                            "rr_ratio": rr,
                            "delta": metrics["delta"],
                            "gamma": metrics["gamma"],
                            "theta": metrics["theta"]
                        })

    if type_upper in ["SHORT STRADDLE", "ALL"]:
        s_call = get_leg(atm_strike, 'C', 'SELL')
        s_put = get_leg(atm_strike, 'P', 'SELL')
        if s_call and s_put:
            legs = [s_call, s_put]
            metrics = project_strategy_py(legs, spot)
            rr = 0.0
            if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
            
            results.append({
                "name": f"Short Straddle ({atm_strike})",
                "symbol": "",
                "expiry": expiry,
                "legs": legs,
                "pop": metrics["pop"],
                "maxProfit": metrics["maxProfit"],
                "maxLoss": metrics["maxLoss"],
                "rr_ratio": rr,
                "delta": metrics["delta"],
                "gamma": metrics["gamma"],
                "theta": metrics["theta"]
            })

    if type_upper in ["LONG STRADDLE", "ALL"]:
        l_call = get_leg(atm_strike, 'C', 'BUY')
        l_put = get_leg(atm_strike, 'P', 'BUY')
        if l_call and l_put:
            legs = [l_call, l_put]
            metrics = project_strategy_py(legs, spot)
            rr = 0.0
            if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
            
            results.append({
                "name": f"Long Straddle ({atm_strike})",
                "symbol": "",
                "expiry": expiry,
                "legs": legs,
                "pop": metrics["pop"],
                "maxProfit": metrics["maxProfit"],
                "maxLoss": metrics["maxLoss"],
                "rr_ratio": rr,
                "delta": metrics["delta"],
                "gamma": metrics["gamma"],
                "theta": metrics["theta"]
            })

    if type_upper in ["SHORT STRANGLE", "ALL"]:
        for offset in range(1, 8):
            put_idx = atm_idx - offset
            call_idx = atm_idx + offset
            if put_idx >= 0 and call_idx < len(strikes):
                s_put = get_leg(strikes[put_idx], 'P', 'SELL')
                s_call = get_leg(strikes[call_idx], 'C', 'SELL')
                if s_put and s_call:
                    legs = [s_put, s_call]
                    metrics = project_strategy_py(legs, spot)
                    rr = 0.0
                    if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                        rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                    
                    results.append({
                        "name": f"Short Strangle ({strikes[put_idx]}/{strikes[call_idx]})",
                        "symbol": "",
                        "expiry": expiry,
                        "legs": legs,
                        "pop": metrics["pop"],
                        "maxProfit": metrics["maxProfit"],
                        "maxLoss": metrics["maxLoss"],
                        "rr_ratio": rr,
                        "delta": metrics["delta"],
                        "gamma": metrics["gamma"],
                        "theta": metrics["theta"]
                    })

    if type_upper in ["LONG STRANGLE", "ALL"]:
        for offset in range(1, 8):
            put_idx = atm_idx - offset
            call_idx = atm_idx + offset
            if put_idx >= 0 and call_idx < len(strikes):
                l_put = get_leg(strikes[put_idx], 'P', 'BUY')
                l_call = get_leg(strikes[call_idx], 'C', 'BUY')
                if l_put and l_call:
                    legs = [l_put, l_call]
                    metrics = project_strategy_py(legs, spot)
                    rr = 0.0
                    if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                        rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                    
                    results.append({
                        "name": f"Long Strangle ({strikes[put_idx]}/{strikes[call_idx]})",
                        "symbol": "",
                        "expiry": expiry,
                        "legs": legs,
                        "pop": metrics["pop"],
                        "maxProfit": metrics["maxProfit"],
                        "maxLoss": metrics["maxLoss"],
                        "rr_ratio": rr,
                        "delta": metrics["delta"],
                        "gamma": metrics["gamma"],
                        "theta": metrics["theta"]
                    })

    if type_upper in ["1:3:2", "1:3:2 CALL RATIO FLY", "ALL"]:
        for d in [2, 3]:
            wing = 2
            sc_idx = atm_idx + d
            lc_idx1 = sc_idx - wing
            lc_idx2 = sc_idx + wing
            
            if lc_idx1 >= 0 and lc_idx2 < len(strikes):
                l_call1 = get_leg(strikes[lc_idx1], 'C', 'BUY')
                s_call = get_leg(strikes[sc_idx], 'C', 'SELL')
                l_call2 = get_leg(strikes[lc_idx2], 'C', 'BUY')
                
                if l_call1 and s_call and l_call2:
                    l_call1["quantity"] = 1.0
                    s_call["quantity"] = 3.0
                    l_call2["quantity"] = 2.0
                    
                    legs = [l_call1, s_call, l_call2]
                    metrics = project_strategy_py(legs, spot)
                    rr = 0.0
                    if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                        rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                        
                    results.append({
                        "name": f"1:3:2 Call Ratio Fly ({strikes[lc_idx1]}/{strikes[sc_idx]}/{strikes[lc_idx2]})",
                        "symbol": "",
                        "expiry": expiry,
                        "legs": legs,
                        "pop": metrics["pop"],
                        "maxProfit": metrics["maxProfit"],
                        "maxLoss": metrics["maxLoss"],
                        "rr_ratio": rr,
                        "delta": metrics["delta"],
                        "gamma": metrics["gamma"],
                        "theta": metrics["theta"]
                    })
                    
    if type_upper in ["PROTECTIVE PUT", "ALL"]:
        for offset in range(0, 8):
            put_idx = atm_idx - offset
            if put_idx >= 0:
                l_put = get_leg(strikes[put_idx], 'P', 'BUY')
                if l_put:
                    l_future = {
                        "strike": spot,
                        "optionType": 'F',
                        "expiry": expiry,
                        "action": 'BUY',
                        "quantity": 1.0,
                        "entryPrice": spot,
                        "iv": 0.0
                    }
                    legs = [l_future, l_put]
                    metrics = project_strategy_py(legs, spot)
                    rr = 0.0
                    if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                        rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                        
                    results.append({
                        "name": f"Protective Put ({strikes[put_idx]} PE)",
                        "symbol": "",
                        "expiry": expiry,
                        "legs": legs,
                        "pop": metrics["pop"],
                        "maxProfit": metrics["maxProfit"],
                        "maxLoss": metrics["maxLoss"],
                        "rr_ratio": rr,
                        "delta": metrics["delta"],
                        "gamma": metrics["gamma"],
                        "theta": metrics["theta"]
                    })

    if type_upper in ["ZERO COST COLLAR", "ALL"]:
        for p_offset in range(1, 8):
            for c_offset in range(1, 8):
                put_idx = atm_idx - p_offset
                call_idx = atm_idx + c_offset
                if put_idx >= 0 and call_idx < len(strikes):
                    l_put = get_leg(strikes[put_idx], 'P', 'BUY')
                    s_call = get_leg(strikes[call_idx], 'C', 'SELL')
                    if l_put and s_call:
                        l_future = {
                            "strike": spot,
                            "optionType": 'F',
                            "expiry": expiry,
                            "action": 'BUY',
                            "quantity": 1.0,
                            "entryPrice": spot,
                            "iv": 0.0
                        }
                        legs = [l_future, l_put, s_call]
                        metrics = project_strategy_py(legs, spot)
                        rr = 0.0
                        if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                            rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                            
                        results.append({
                            "name": f"Zero-Cost Collar ({strikes[put_idx]} PE / {strikes[call_idx]} CE)",
                            "symbol": "",
                            "expiry": expiry,
                            "legs": legs,
                            "pop": metrics["pop"],
                            "maxProfit": metrics["maxProfit"],
                            "maxLoss": metrics["maxLoss"],
                            "rr_ratio": rr,
                            "delta": metrics["delta"],
                            "gamma": metrics["gamma"],
                            "theta": metrics["theta"]
                        })

    if type_upper in ["PUT SPREAD COLLAR", "ALL"]:
        wing = 2
        for p_offset in range(1, 8):
            for c_offset in range(1, 8):
                put_idx1 = atm_idx - p_offset
                put_idx2 = put_idx1 - wing
                call_idx = atm_idx + c_offset
                if put_idx2 >= 0 and call_idx < len(strikes):
                    l_put = get_leg(strikes[put_idx1], 'P', 'BUY')
                    s_put = get_leg(strikes[put_idx2], 'P', 'SELL')
                    s_call = get_leg(strikes[call_idx], 'C', 'SELL')
                    if l_put and s_put and s_call:
                        l_future = {
                            "strike": spot,
                            "optionType": 'F',
                            "expiry": expiry,
                            "action": 'BUY',
                            "quantity": 1.0,
                            "entryPrice": spot,
                            "iv": 0.0
                        }
                        legs = [l_future, l_put, s_put, s_call]
                        metrics = project_strategy_py(legs, spot)
                        rr = 0.0
                        if isinstance(metrics["maxLoss"], (int, float)) and metrics["maxLoss"] != 0:
                            rr = abs(metrics["maxProfit"]) / abs(metrics["maxLoss"]) if isinstance(metrics["maxProfit"], (int, float)) else 999.0
                            
                        results.append({
                            "name": f"Put Spread Collar ({strikes[put_idx2]}/{strikes[put_idx1]} PE / {strikes[call_idx]} CE)",
                            "symbol": "",
                            "expiry": expiry,
                            "legs": legs,
                            "pop": metrics["pop"],
                            "maxProfit": metrics["maxProfit"],
                            "maxLoss": metrics["maxLoss"],
                            "rr_ratio": rr,
                            "delta": metrics["delta"],
                            "gamma": metrics["gamma"],
                            "theta": metrics["theta"]
                        })
                        
    return results

# Main periodic alert scanning background worker
async def active_alerts_scanner_loop():
    market_service = MarketDataService()
    
    print("[Alert Scanner] Server-side background active scanner thread started.")
    await asyncio.sleep(10) # Wait for startup schemas to build
    
    while True:
        try:
            # A. Check and update open portfolios for Take Profit and Stop Loss triggers
            async with async_session() as session:
                portfolio_result = await session.execute(
                    select(Portfolio, User.phone_number)
                    .join(User, Portfolio.user_id == User.id)
                )
                portfolio_rows = portfolio_result.all()
                
                open_portfolios_data = []
                for p, phone in portfolio_rows:
                    is_closed = (p.realizedPnL != 0.0)
                    if not is_closed and p.legs:
                        legs_list = p.legs if isinstance(p.legs, list) else json.loads(p.legs or "[]")
                        if any(leg.get("status") == "SQUARED_OFF" for leg in legs_list):
                            is_closed = True
                    if not is_closed:
                        open_portfolios_data.append((p, phone))
                        
                if open_portfolios_data:
                    # Gather unique symbols
                    portfolio_symbols = {p.symbol.upper() for p, phone in open_portfolios_data}
                    spot_prices = {}
                    for sym in portfolio_symbols:
                        try:
                            spot_data = await asyncio.to_thread(market_service.get_underlying_data, sym)
                            if spot_data and "spot" in spot_data:
                                spot_prices[sym] = spot_data["spot"]
                        except Exception as e:
                            print(f"[Alert Scanner] Error fetching spot price for portfolio symbol {sym}: {e}")
                            
                    # Evaluate each portfolio
                    updated_count = 0
                    for p, phone in open_portfolios_data:
                        sym = p.symbol.upper()
                        spot_price = spot_prices.get(sym, 0.0)
                        if spot_price == 0.0:
                            continue
                            
                        # Calculate unrealizedPnL
                        total_unrealized_pnl = 0.0
                        today = datetime.now()
                        legs_list = p.legs if isinstance(p.legs, list) else json.loads(p.legs or "[]")
                        if not legs_list:
                            continue
                        
                        for leg in legs_list:
                            try:
                                expiry_dt = datetime.strptime(leg["expiry"], "%Y-%m-%d")
                            except Exception:
                                continue
                            remaining_days = max(0, (expiry_dt - today).days)
                            T = remaining_days / 365.0
                            
                            if leg["optionType"] == 'F':
                                price = spot_price
                                diff = spot_price - leg["entryPrice"]
                                pnl = diff * leg["quantity"] if leg["action"] == "BUY" else -diff * leg["quantity"]
                            else:
                                price = bs_pricing(spot_price, leg["strike"], T, 0.05, leg["iv"], leg["optionType"])
                                entry_val = leg["entryPrice"] * leg["quantity"]
                                current_val = price * leg["quantity"]
                                pnl = (current_val - entry_val) if leg["action"] == "BUY" else (entry_val - current_val)
                            
                            total_unrealized_pnl += pnl
                            
                        unrealized_pnl = round(total_unrealized_pnl, 2)
                        
                        # Track Peak Profit and Max Drawdown in DB
                        peak_profit = p.peakProfit if p.peakProfit is not None else 0.0
                        max_drawdown = p.maxDrawdown if p.maxDrawdown is not None else 0.0
                        needs_db_update = False
                        
                        if unrealized_pnl > peak_profit:
                            p.peakProfit = unrealized_pnl
                            needs_db_update = True
                        if unrealized_pnl < max_drawdown:
                            p.maxDrawdown = unrealized_pnl
                            needs_db_update = True
                        
                        # Get Strategy Metrics
                        metrics = project_strategy_py(legs_list, spot_price)
                        max_profit_num = metrics["maxProfit"] if isinstance(metrics["maxProfit"], (int, float)) else 0.0
                        max_loss_num = metrics["maxLoss"] if isinstance(metrics["maxLoss"], (int, float)) else 0.0
                        
                        tp_val = p.takeProfit if p.takeProfit is not None else 20.0
                        sl_val = p.stopLoss if p.stopLoss is not None else 0.0
                        
                        tp_trigger = round(max_profit_num * (tp_val / 100.0), 2)
                        sl_trigger = round(-max_loss_num * (sl_val / 100.0), 2)
                        
                        is_tp_triggered = tp_val > 0.0 and unrealized_pnl >= tp_trigger and metrics["maxProfit"] != 'Unlimited'
                        is_sl_triggered = sl_val > 0.0 and unrealized_pnl <= sl_trigger and metrics["maxLoss"] != 'Unlimited'
                        
                        if is_tp_triggered or is_sl_triggered:
                            trigger_reason = "Take Profit" if is_tp_triggered else "Stop Loss"
                            cur = get_currency_symbol_py(p.symbol)
                            cur_log = "INR" if cur == "₹" else cur
                            print(f"[Alert Scanner] Auto-squaring off open portfolio '{p.name}' ({p.id}) due to {trigger_reason} trigger! MTM: {cur_log}{unrealized_pnl}")
                            
                            p.realizedPnL = unrealized_pnl
                            p.marginDeployed = 0.0
                            
                            # Mark all legs as SQUARED_OFF
                            for leg in legs_list:
                                leg["status"] = "SQUARED_OFF"
                                leg["realizedPnL"] = unrealized_pnl / len(legs_list) if legs_list else 0.0
                            p.legs = list(legs_list)
                            from sqlalchemy.orm.attributes import flag_modified
                            flag_modified(p, "legs")
                            
                            needs_db_update = True
                            
                            # Send real-time notification
                            await send_portfolio_squareoff_notification(p, trigger_reason, unrealized_pnl, phone)
                            
                        if needs_db_update:
                            session.add(p)
                            updated_count += 1
                            
                    if updated_count > 0:
                        await session.commit()
                        print(f"[Alert Scanner] Successfully updated/squared off {updated_count} portfolios in database.")

            # 1. Fetch active rules
            async with async_session() as session:
                result = await session.execute(
                    select(AlertRule, User.phone_number)
                    .join(User, AlertRule.user_id == User.id)
                    .where(AlertRule.active == True)
                    .where(User.is_auto_scanning == True)
                )
                rules_list = result.all()
                
            if not rules_list:
                await asyncio.sleep(60)
                continue

            # Fetch all triggered alerts created today to prevent duplicate legs alerts today
            today_start = datetime.combine(datetime.now().date(), datetime.min.time())
            async with async_session() as session:
                from app.db.models import TriggeredAlert
                result_alerts = await session.execute(
                    select(TriggeredAlert).where(TriggeredAlert.created_at >= today_start)
                )
                today_alerts = list(result_alerts.scalars().all())
                
            print(f"[Alert Scanner] Scanning {len(rules_list)} active server-side rules...")
            
            # Group rules by symbol to minimize HTTP requests
            symbols_to_scan = set()
            for rule, phone in rules_list:
                if rule.symbol == "ALL":
                    symbols_to_scan.add("NIFTY") # default core scanning symbol
                elif rule.symbol == "ALL_NSE":
                    for s in NSE_FO_STOCKS:
                        symbols_to_scan.add(s)
                else:
                    symbols_to_scan.add(rule.symbol.upper())
                    
            for sym in symbols_to_scan:
                try:
                    # 2. Fetch options chain
                    chain = await asyncio.to_thread(market_service.get_option_chain, sym)
                    options = chain.get("options", [])
                    spot = chain.get("underlying", {}).get("spot", 0.0)
                    expiry = chain.get("selected_expiry")
                    
                    if not options or spot == 0.0:
                        continue
                        
                    is_all_nse_match = lambda r: (r.symbol == "ALL_NSE" and sym in NSE_FO_STOCKS)
                    matching_rules = [r for r, p in rules_list if r.symbol == "ALL" or is_all_nse_match(r) or r.symbol.upper() == sym]
                    
                    for rule, phone in rules_list:
                        if rule.symbol != "ALL" and not (rule.symbol == "ALL_NSE" and sym in NSE_FO_STOCKS) and rule.symbol.upper() != sym:
                            continue
                            
                        # 3. Scan strategies for the rule strategy type
                        rule_expiry = None if rule.expiry == "ALL" else rule.expiry
                        if rule_expiry is None or rule_expiry == expiry:
                            rule_options = options
                            rule_spot = spot
                            rule_selected_expiry = expiry
                        else:
                            try:
                                rule_chain = await asyncio.to_thread(market_service.get_option_chain, sym, rule_expiry)
                                rule_options = rule_chain.get("options", [])
                                rule_spot = rule_chain.get("underlying", {}).get("spot", 0.0)
                                rule_selected_expiry = rule_chain.get("selected_expiry")
                            except Exception as e:
                                print(f"[Alert Scanner] Error fetching option chain for {sym} expiry {rule_expiry}: {e}")
                                continue
                                
                        if not rule_options or rule_spot == 0.0:
                            continue

                        scans = scan_strategies_py(rule.strategy_type, rule_options, rule_spot, rule_selected_expiry)
                        
                        for scan in scans:
                            # Evaluate match criteria
                            pop_match = scan["pop"] >= rule.min_pop
                            rr_match = scan["rr_ratio"] >= rule.min_rr
                            
                            loss_match = False
                            if rule.max_loss <= 0:
                                loss_match = True
                            elif isinstance(scan["maxLoss"], (int, float)):
                                min_loss_val = rule.min_loss if rule.min_loss is not None else 0.0
                                loss_match = min_loss_val <= scan["maxLoss"] <= rule.max_loss
                            elif scan["maxLoss"] == 'Unlimited':
                                loss_match = rule.max_loss >= 100000 or rule.strategy_type.upper() in ["SHORT STRADDLE", "SHORT STRANGLE", "LONG STRADDLE", "LONG STRANGLE"]
                                
                            delta_match = True
                            if rule.min_delta is not None and scan["delta"] < rule.min_delta:
                                delta_match = False
                            if rule.max_delta is not None and scan["delta"] > rule.max_delta:
                                delta_match = False
                                
                            theta_match = True
                            if rule.min_theta is not None and scan["theta"] < rule.min_theta:
                                theta_match = False
                                
                            if pop_match and rr_match and loss_match and delta_match and theta_match:
                                # Ensure no duplicate signals with same legs repeat for the day
                                scan_legs = scan.get("legs", [])
                                scan_legs_hash = get_legs_hash(scan_legs)
                                already_triggered_today = False
                                for ta in today_alerts:
                                    if ta.user_id == rule.user_id:
                                        ta_legs = ta.legs if isinstance(ta.legs, list) else json.loads(ta.legs or "[]")
                                        if get_legs_hash(ta_legs) == scan_legs_hash:
                                            already_triggered_today = True
                                            break
                                if already_triggered_today:
                                    continue

                                # Prevent duplicate alerts and trades within a 5-minute cooldown window
                                trigger_key = f"{rule.id}_{scan['name']}_{scan['expiry']}"
                                now = time.time()
                                last_trigger = triggered_alerts_cache.get(trigger_key, 0)
                                if now - last_trigger < 300:
                                    continue
                                triggered_alerts_cache[trigger_key] = now

                                scan["symbol"] = sym
                                
                                # A. Send Notification Alert
                                await send_notification_alert(rule, scan, spot, phone)
                                
                                # Log alert persistently in triggered_alerts DB table
                                cur = get_currency_symbol_py(sym)
                                max_profit_str = f"{cur}{scan['maxProfit']:.2f}" if isinstance(scan['maxProfit'], (int, float)) else str(scan['maxProfit'])
                                max_loss_str = f"{cur}{scan['maxLoss']:.2f}" if isinstance(scan['maxLoss'], (int, float)) else str(scan['maxLoss'])
                                
                                db_triggered = TriggeredAlert(
                                    id=str(uuid.uuid4()),
                                    user_id=rule.user_id,
                                    symbol=sym,
                                    strategy_name=scan["name"],
                                    expiry=scan["expiry"],
                                    pop=round(scan["pop"], 1),
                                    max_profit=max_profit_str,
                                    max_loss=max_loss_str,
                                    rr_ratio=round(scan["rr_ratio"], 1),
                                    timestamp=datetime.now().strftime("%I:%M:%S %p"),
                                    current_pnl=f"{cur}0.00",
                                    spot_price=spot,
                                    legs=scan.get("legs", []),
                                    rule_id=rule.id
                                )
                                async with async_session() as session3:
                                    session3.add(db_triggered)
                                    await session3.commit()
                                print(f"[Alert Scanner] Persistent alert logged for rule {rule.id} on asset {sym}.")
                                today_alerts.append(db_triggered)
                                
                                # B. Auto-Execute Paper Trade if checked!
                                if rule.auto_execute:
                                    print(f"[Alert Scanner Bot] AUTO EXECUTE Paper Trade triggered for rule {rule.id} on asset {sym}!")
                                    legs_saved = []
                                    for leg in scan["legs"]:
                                        legs_saved.append({
                                            "id": str(uuid.uuid4())[:8],
                                            "strike": leg["strike"],
                                            "optionType": leg["optionType"],
                                            "expiry": leg["expiry"],
                                            "action": leg["action"],
                                            "quantity": 1, # default 1 lot
                                            "entryPrice": leg.get("entryPrice") or 1.0,
                                            "currentPrice": leg.get("entryPrice") or 1.0,
                                            "iv": leg.get("iv") or 0.25,
                                            "status": "ACTIVE",
                                            "realizedPnL": 0.0
                                        })
                                    
                                    # Create Portfolio entry
                                    portfolio_name = f"Paper Auto: {scan['name']}"
                                    portfolio_id = str(uuid.uuid4())
                                    
                                    db_portfolio = Portfolio(
                                        id=portfolio_id,
                                        user_id=rule.user_id,
                                        name=portfolio_name,
                                        symbol=sym,
                                        description=f"Auto-Executed Paper Trade via Alert Rule {rule.id}",
                                        legs=legs_saved,
                                        createdAt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                                        marginDeployed=0.0,
                                        realizedPnL=0.0,
                                        entrySpot=spot,
                                        peakProfit=0.0,
                                        maxDrawdown=0.0,
                                        takeProfit=rule.take_profit if rule.take_profit is not None else 20.0,
                                        stopLoss=rule.stop_loss if rule.stop_loss is not None else 0.0
                                    )
                                    
                                    # Save position & Deactivate rule
                                    async with async_session() as session2:
                                        session2.add(db_portfolio)
                                        await session2.execute(
                                            update(AlertRule)
                                            .where(AlertRule.id == rule.id)
                                            .values(active=False)
                                        )
                                        await session2.commit()
                                    print(f"[Alert Scanner Bot] Deactivated rule {rule.id} and saved paper portfolio {portfolio_id}.")
                                    break
                                    
                except Exception as e:
                    print(f"[Alert Scanner] Error scanning symbol {sym}: {e}")
                    
        except Exception as e:
            print(f"[Alert Scanner] Error in main scan cycle: {e}")
            
        await asyncio.sleep(60) # Scan every 60 seconds
