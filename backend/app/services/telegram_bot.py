import os
import asyncio
import httpx
import subprocess
import platform
import json
from datetime import datetime
from typing import Optional, List

from sqlalchemy import select, func
from app.db.session import async_session
from app.db.models import Portfolio, AlertRule, User, TriggeredAlert
from app.services.market_data import MarketDataService
from app.quant.black_scholes import bs_pricing
from app.services.alert_scanner import scan_strategies_py, project_strategy_py

market_service = MarketDataService()

async def send_telegram_msg(token: str, chat_id: int, text: str):
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(url, json=payload, timeout=10.0)
            if resp.status_code != 200:
                print(f"[Telegram Bot] Error sending message: Status {resp.status_code}, Body: {resp.text}")
    except Exception as e:
        print(f"[Telegram Bot] Exception sending message: {e}")

async def start_telegram_bot():
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        print("[Telegram Bot] Disabled: TELEGRAM_BOT_TOKEN not configured in .env")
        return
        
    print("[Telegram Bot] Starting active background long-polling service...")
    offset = 0
    client = httpx.AsyncClient()
    
    # Simple polling loop
    while True:
        try:
            url = f"https://api.telegram.org/bot{token}/getUpdates"
            params = {"offset": offset, "timeout": 20}
            resp = await client.get(url, params=params, timeout=25.0)
            if resp.status_code == 200:
                data = resp.json()
                if data.get("ok"):
                    for update in data.get("result", []):
                        offset = update["update_id"] + 1
                        message = update.get("message")
                        if message and "text" in message:
                            # Run message handler asynchronously to keep polling responsive
                            asyncio.create_task(handle_message(token, message))
            elif resp.status_code == 401:
                print("[Telegram Bot] Unauthorized: Invalid TELEGRAM_BOT_TOKEN.")
                await asyncio.sleep(60)
            else:
                print(f"[Telegram Bot] Poll error: status code {resp.status_code}")
                await asyncio.sleep(10)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Telegram Bot] Exception in poll loop: {str(e)}")
            await asyncio.sleep(5)
            
    await client.aclose()

async def handle_message(token: str, message: dict):
    chat_id = message["chat"]["id"]
    text = message["text"].strip()
    
    # Security: check authorization if TELEGRAM_CHAT_ID is set
    allowed_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    if allowed_chat_id and str(chat_id) != str(allowed_chat_id):
        await send_telegram_msg(token, chat_id, "⚠️ <b>Unauthorized</b>. This bot is configured to only accept commands from its owner.")
        return
        
    if not text.startswith("/"):
        return
        
    parts = text.split(" ")
    command = parts[0].lower()
    args = parts[1:]
    
    if command in ["/start", "/help"]:
        await handle_help(token, chat_id)
    elif command == "/status":
        await handle_status(token, chat_id)
    elif command in ["/market", "/nifty"]:
        await handle_market(token, chat_id)
    elif command == "/portfolios":
        await handle_portfolios(token, chat_id)
    elif command == "/portfolio":
        await handle_portfolio_detail(token, chat_id, args)
    elif command == "/scan":
        await handle_scan(token, chat_id)
    elif command in ["/list_batch", "/batch"]:
        await handle_list_batch(token, chat_id)
    elif command == "/run_batch":
        await handle_run_batch(token, chat_id, args)
    else:
        await send_telegram_msg(token, chat_id, f"Unknown command: {command}. Type /help to see all available commands.")

async def handle_help(token: str, chat_id: int):
    allowed_chat_id = os.getenv("TELEGRAM_CHAT_ID")
    warning = ""
    if not allowed_chat_id:
        warning = "⚠️ <b>Warning:</b> TELEGRAM_CHAT_ID is not configured in .env. The bot is in open mode. Set your Chat ID in .env to secure it.\n\n"
        
    help_text = (
        "🤖 <b>OptionsOracle Reborn Telegram Bot</b>\n\n"
        f"{warning}"
        "You can use the following commands to monitor and control the system:\n\n"
        "📊 <b>Market & Status</b>\n"
        "/status - Check FastAPI status, DB info, and active count\n"
        "/market - Get current index (Nifty) and commodity prices\n\n"
        "💼 <b>Portfolio & Trading</b>\n"
        "/portfolios - List active paper/live strategy portfolios\n"
        "/portfolio &lt;name or ID&gt; - Get detailed legs, LTP, and P&amp;L of a strategy\n"
        "/scan - Trigger the options alert scanner manually\n\n"
        "⚙️ <b>Remote Administration</b>\n"
        "/list_batch - List all batch (.bat) files in the server root\n"
        "/run_batch &lt;file.bat&gt; - Run a batch file and see output"
    )
    await send_telegram_msg(token, chat_id, help_text)

async def handle_status(token: str, chat_id: int):
    try:
        async with async_session() as session:
            p_stmt = select(func.count()).select_from(Portfolio)
            p_res = await session.execute(p_stmt)
            p_count = p_res.scalar() or 0
            
            r_stmt = select(func.count()).select_from(AlertRule)
            r_res = await session.execute(r_stmt)
            r_count = r_res.scalar() or 0
            
        status_text = (
            "🟢 <b>OptionsOracle Services: ONLINE</b>\n\n"
            f"🖥️ <b>Host Platform:</b> {platform.system()} ({platform.release()})\n"
            f"🕒 <b>Server Time:</b> {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n"
            f"🗄️ <b>Active Portfolios:</b> {p_count}\n"
            f"⚙️ <b>Active Alert Rules:</b> {r_count}\n"
            "🌐 <b>API Status:</b> Listening on port 8000"
        )
        await send_telegram_msg(token, chat_id, status_text)
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error checking status: {str(e)}")

async def handle_market(token: str, chat_id: int):
    await send_telegram_msg(token, chat_id, "⏳ Fetching market rates...")
    try:
        nifty = market_service.get_underlying_data("NIFTY")
        banknifty = market_service.get_underlying_data("BANKNIFTY")
        gold = market_service.get_underlying_data("GOLD")
        silver = market_service.get_underlying_data("SILVER")
        crude = market_service.get_underlying_data("CRUDEOIL")
        
        msg = (
            "📊 <b>Current Market Prices</b>\n\n"
            f"🇮🇳 <b>NIFTY 50:</b> ₹{nifty.get('spot', 0):,.2f} "
            f"({'+' if nifty.get('change', 0) >= 0 else ''}{nifty.get('change', 0):.2f} / "
            f"{'+' if nifty.get('pct_change', 0) >= 0 else ''}{nifty.get('pct_change', 0):.2f}%)\n"
            
            f"🏦 <b>BANKNIFTY:</b> ₹{banknifty.get('spot', 0):,.2f} "
            f"({'+' if banknifty.get('change', 0) >= 0 else ''}{banknifty.get('change', 0):.2f} / "
            f"{'+' if banknifty.get('pct_change', 0) >= 0 else ''}{banknifty.get('pct_change', 0):.2f}%)\n\n"
            
            f"🟡 <b>GOLD:</b> ₹{gold.get('spot', 0):,.2f} ({gold.get('pct_change', 0):+.2f}%)\n"
            f"⚪ <b>SILVER:</b> ₹{silver.get('spot', 0):,.2f} ({silver.get('pct_change', 0):+.2f}%)\n"
            f"🛢️ <b>CRUDE OIL:</b> ₹{crude.get('spot', 0):,.2f} ({crude.get('pct_change', 0):+.2f}%)\n"
        )
        await send_telegram_msg(token, chat_id, msg)
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error fetching market rates: {str(e)}")

async def handle_portfolios(token: str, chat_id: int):
    try:
        async with async_session() as session:
            stmt = select(Portfolio)
            res = await session.execute(stmt)
            portfolios = res.scalars().all()
            
        if not portfolios:
            await send_telegram_msg(token, chat_id, "💼 No active portfolios found in database.")
            return
            
        msg_lines = ["💼 <b>Active Portfolios & Strategies</b>\n"]
        for p in portfolios:
            legs_list = p.legs if isinstance(p.legs, list) else json.loads(p.legs or "[]")
            msg_lines.append(
                f"• <b>{p.name}</b> ({p.symbol})\n"
                f"  ID: <code>{p.id}</code>\n"
                f"  Realized P&amp;L: ₹{p.realizedPnL:,.2f} | Margin: ₹{p.marginDeployed:,.2f}\n"
                f"  Legs count: {len(legs_list)}\n"
            )
        
        await send_telegram_msg(token, chat_id, "\n".join(msg_lines))
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error listing portfolios: {str(e)}")

async def handle_portfolio_detail(token: str, chat_id: int, args: List[str]):
    if not args:
        await send_telegram_msg(token, chat_id, "⚠️ Please specify a portfolio ID or Name. Usage: <code>/portfolio &lt;id_or_name&gt;</code>")
        return
        
    query_str = " ".join(args).strip().lower()
    try:
        async with async_session() as session:
            stmt = select(Portfolio)
            res = await session.execute(stmt)
            portfolios = res.scalars().all()
            
        matched = None
        for p in portfolios:
            if p.id.lower() == query_str or query_str in p.name.lower():
                matched = p
                break
                
        if not matched:
            await send_telegram_msg(token, chat_id, f"❌ Portfolio matching '{query_str}' not found.")
            return
            
        # Fetch underlying spot price
        spot = 0.0
        try:
            underlying = market_service.get_underlying_data(matched.symbol)
            spot = underlying.get("spot", 0.0)
        except Exception:
            pass
            
        msg_lines = [
            f"💼 <b>Strategy: {matched.name}</b>",
            f"Symbol: {matched.symbol} | Spot: ₹{spot:,.2f}",
            f"ID: <code>{matched.id}</code>\n",
            "🔍 <b>Legs Details:</b>"
        ]
        
        legs_list = matched.legs if isinstance(matched.legs, list) else json.loads(matched.legs or "[]")
        total_pnl = 0.0
        
        for i, leg in enumerate(legs_list, 1):
            action = leg.get("action", "BUY")
            qty = leg.get("quantity", 0)
            strike = leg.get("strike", 0.0)
            opt_type = leg.get("optionType", "C")
            entry_price = leg.get("entryPrice", 0.0)
            
            # Get current price
            current_price = entry_price
            try:
                chain = market_service.get_option_chain(matched.symbol, leg.get("expiry"))
                if chain and "options" in chain:
                    for opt_row in chain["options"]:
                        if float(opt_row["strike"]) == float(strike):
                            contract = opt_row.get(f"{opt_type}E") or opt_row.get(f"{opt_type}")
                            if contract:
                                current_price = contract.get("lastPrice") or contract.get("bid") or contract.get("ask") or entry_price
                                break
            except Exception:
                pass
                
            # Fallback to BSM pricing if live price failed to fetch and it is not a future
            if current_price == entry_price and opt_type != 'F' and spot > 0.0:
                try:
                    expiry_dt = datetime.strptime(leg["expiry"], "%Y-%m-%d")
                    remaining_days = max(0, (expiry_dt - datetime.now()).days)
                    T = remaining_days / 365.0
                    iv = leg.get("iv", 0.16)
                    current_price = bs_pricing(spot, strike, T, 0.05, iv, opt_type)
                except Exception:
                    pass
                    
            leg_entry_val = entry_price * qty
            leg_curr_val = current_price * qty
            
            if action == "BUY":
                leg_pnl = leg_curr_val - leg_entry_val
            else:
                leg_pnl = leg_entry_val - leg_curr_val
                
            total_pnl += leg_pnl
            
            msg_lines.append(
                f"<b>{i}. {action} {qty}x {strike} {opt_type}E</b>\n"
                f"  Entry: ₹{entry_price:.2f} | LTP: ₹{current_price:.2f}\n"
                f"  PnL: ₹{leg_pnl:,.2f}"
            )
            
        msg_lines.append(f"\n📊 <b>Total Current P&amp;L:</b> ₹{total_pnl:,.2f}")
        await send_telegram_msg(token, chat_id, "\n".join(msg_lines))
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error getting portfolio details: {str(e)}")

async def handle_scan(token: str, chat_id: int):
    await send_telegram_msg(token, chat_id, "⏳ Triggering active alert scanner rules evaluation...")
    try:
        async with async_session() as session:
            result = await session.execute(
                select(AlertRule, User.phone_number)
                .join(User, AlertRule.user_id == User.id)
                .where(AlertRule.active == True)
            )
            rules_list = result.all()
            
        if not rules_list:
            await send_telegram_msg(token, chat_id, "ℹ️ No active alert rules found to scan.")
            return
            
        # Group rules by symbol
        symbols_to_scan = set()
        for rule, phone in rules_list:
            if rule.symbol == "ALL":
                symbols_to_scan.add("NIFTY")
            else:
                symbols_to_scan.add(rule.symbol.upper())
                
        alerts_found = []
        
        for sym in symbols_to_scan:
            try:
                chain = await asyncio.to_thread(market_service.get_option_chain, sym)
                options = chain.get("options", [])
                spot = chain.get("underlying", {}).get("spot", 0.0)
                expiry = chain.get("selected_expiry")
                
                if not options or spot == 0.0:
                    continue
                    
                for rule, phone in rules_list:
                    if rule.symbol != "ALL" and rule.symbol.upper() != sym:
                        continue
                        
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
                        except Exception:
                            continue
                            
                    if not rule_options or rule_spot == 0.0:
                        continue
                        
                    scans = scan_strategies_py(rule.strategy_type, rule_options, rule_spot, rule_selected_expiry)
                    for scan in scans:
                        pop_match = scan["pop"] >= rule.min_pop
                        rr_match = scan["rr_ratio"] >= rule.min_rr
                        
                        loss_match = False
                        if rule.max_loss <= 0:
                            loss_match = True
                        elif isinstance(scan["maxLoss"], (int, float)):
                            min_loss_val = rule.min_loss if rule.min_loss is not None else 0.0
                            loss_match = min_loss_val <= scan["maxLoss"] <= rule.max_loss
                        elif scan["maxLoss"] == 'Unlimited':
                            loss_match = rule.max_loss >= 100000
                            
                        delta_match = True
                        if rule.min_delta is not None and scan["delta"] < rule.min_delta:
                            delta_match = False
                        if rule.max_delta is not None and scan["delta"] > rule.max_delta:
                            delta_match = False
                            
                        if pop_match and rr_match and loss_match and delta_match:
                            alerts_found.append({
                                "symbol": sym,
                                "strategy": rule.strategy_type,
                                "expiry": rule_selected_expiry,
                                "pop": scan["pop"],
                                "rr": scan["rr_ratio"],
                                "max_profit": scan["maxProfit"],
                                "max_loss": scan["maxLoss"]
                            })
            except Exception as e:
                print(f"[Telegram Scanner] Error scanning symbol {sym}: {e}")
                
        if not alerts_found:
            await send_telegram_msg(token, chat_id, "✅ Scan complete. No new matches found for active rules.")
            return
            
        msg = f"🔔 <b>Scan complete! Found {len(alerts_found)} opportunities:</b>\n\n"
        for alert in alerts_found[:8]:
            max_p = f"₹{alert['max_profit']:,.2f}" if isinstance(alert['max_profit'], (int, float)) else alert['max_profit']
            max_l = f"₹{alert['max_loss']:,.2f}" if isinstance(alert['max_loss'], (int, float)) else alert['max_loss']
            msg += (
                f"• <b>{alert['strategy']}</b> ({alert['symbol']})\n"
                f"  Expiry: {alert['expiry']} | POP: {alert['pop']:.1f}%\n"
                f"  R:R: 1:{alert['rr']:.2f} | Max Profit: {max_p} | Max Loss: {max_l}\n\n"
            )
        await send_telegram_msg(token, chat_id, msg)
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error executing scan: {str(e)}")

async def handle_list_batch(token: str, chat_id: int):
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    try:
        bat_files = [f for f in os.listdir(root_dir) if f.endswith(".bat")]
        if not bat_files:
            await send_telegram_msg(token, chat_id, "📂 No batch (.bat) files found in the server root directory.")
            return
            
        msg = "📂 <b>Available Batch Files:</b>\n\n"
        for f in bat_files:
            msg += f"• <code>{f}</code> - Run with: <code>/run_batch {f}</code>\n"
            
        await send_telegram_msg(token, chat_id, msg)
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error listing batch files: {str(e)}")

async def handle_run_batch(token: str, chat_id: int, args: List[str]):
    if not args:
        await send_telegram_msg(token, chat_id, "⚠️ Please specify the batch file to run. E.g. <code>/run_batch start_servers.bat</code>")
        return
        
    filename = args[0].strip()
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    file_path = os.path.normpath(os.path.join(root_dir, filename))
    
    # Security: check if file is a .bat file and lies in the workspace root
    if not file_path.startswith(root_dir) or not filename.endswith(".bat"):
        await send_telegram_msg(token, chat_id, "❌ Security Error: You can only run .bat files located in the root directory.")
        return
        
    if not os.path.exists(file_path):
        await send_telegram_msg(token, chat_id, f"❌ File not found: <code>{filename}</code>")
        return
        
    if filename == "start_servers.bat":
        await send_telegram_msg(token, chat_id, "⚠️ <b>Warning:</b> running start_servers.bat will terminate the current backend process. The Telegram bot will restart automatically when the new backend process starts.")
        
    await send_telegram_msg(token, chat_id, f"⚙️ Running <code>{filename}</code> in background...")
    
    try:
        # Run it asynchronously
        process = await asyncio.create_subprocess_shell(
            f'"{file_path}"',
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=root_dir
        )
        
        # Wait up to 5 seconds to capture any early output
        try:
            stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=5.0)
            stdout_str = stdout.decode('cp1252', errors='ignore')
            stderr_str = stderr.decode('cp1252', errors='ignore')
            
            output = f"✅ <b>Finished running {filename}:</b>\n\n"
            if stdout_str:
                output += f"<b>Output:</b>\n<pre>{stdout_str[:1200]}</pre>\n"
            if stderr_str:
                output += f"<b>Error Output:</b>\n<pre>{stderr_str[:800]}</pre>\n"
            await send_telegram_msg(token, chat_id, output)
        except asyncio.TimeoutError:
            await send_telegram_msg(token, chat_id, f"ℹ️ <code>{filename}</code> is running in the background. (Output capture timed out, process continued).")
    except Exception as e:
        await send_telegram_msg(token, chat_id, f"❌ Error running batch file: {str(e)}")
