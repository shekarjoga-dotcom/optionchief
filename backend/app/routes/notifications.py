import os
import httpx
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.routes.auth import get_current_user
from app.db.models import User
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

class TriggerAlertSchema(BaseModel):
    strategy_name: str
    symbol: str
    expiry: str
    pop: float
    max_profit: str
    max_loss: str
    rr_ratio: float
    timestamp: str
    channel: str  # "muted", "web_only", "sms", "telegram", "whatsapp", "email", "both"
    phone_number: Optional[str] = None
    telegram_bot_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    whatsapp_number: Optional[str] = None
    recipient_email: Optional[str] = None
    current_pnl: Optional[str] = "₹0.00"
    spot_price: Optional[float] = None
    legs: Optional[List[dict]] = None

def send_alert_sms(phone_number: str, message_text: str):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")

    if account_sid and auth_token and from_number:
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            message = client.messages.create(
                body=message_text,
                from_=from_number,
                to=phone_number
            )
            print(f"[Twilio SMS] Sent Alert to {phone_number}, SID: {message.sid}")
            return True
        except Exception as e:
            print(f"[Twilio SMS] Error sending alert SMS: {str(e)}")
            
    # Mock fallback print
    print("\n" + "="*50)
    print(f"  [SMS ALERT MOCK] SMS to {phone_number}:")
    print(f"  {message_text}")
    print("="*50 + "\n")
    return False

def send_alert_whatsapp(phone_number: str, message_text: str):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    whatsapp_from = os.getenv("TWILIO_WHATSAPP_NUMBER") # e.g. "whatsapp:+14155238886"

    if account_sid and auth_token and whatsapp_from:
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            
            # Ensure number is prefixed with 'whatsapp:'
            to_number = phone_number if phone_number.startswith("whatsapp:") else f"whatsapp:{phone_number}"
            from_number = whatsapp_from if whatsapp_from.startswith("whatsapp:") else f"whatsapp:{whatsapp_from}"
            
            message = client.messages.create(
                body=message_text,
                from_=from_number,
                to=to_number
            )
            print(f"[Twilio WhatsApp] Sent Alert to {phone_number}, SID: {message.sid}")
            return True
        except Exception as e:
            print(f"[Twilio WhatsApp] Error sending WhatsApp alert: {str(e)}")

    # Mock fallback print
    print("\n" + "="*50)
    print(f"  [WHATSAPP ALERT MOCK] WhatsApp to {phone_number}:")
    print(f"  {message_text}")
    print("="*50 + "\n")
    return False

async def send_alert_telegram(bot_token: Optional[str], chat_id: Optional[str], message_text: str):
    token = bot_token or os.getenv("TELEGRAM_BOT_TOKEN")
    chat = chat_id or os.getenv("TELEGRAM_CHAT_ID")
    
    if not token or not chat:
        print("[Telegram Alert] Skipped. Token or Chat ID not provided or set in environment.")
        return False
        
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat,
        "text": message_text,
        "parse_mode": "HTML"
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload, timeout=10.0)
            if response.status_code == 200:
                print(f"[Telegram Alert] Sent successfully to chat {chat}")
                return True
            else:
                print(f"[Telegram Alert] Error: Status {response.status_code}, Body: {response.text}")
                return False
    except Exception as e:
        print(f"[Telegram Alert] Exception: {str(e)}")
        return False

def send_alert_email(recipient_email: str, subject: str, html_content: str, chart_bytes: bytes = None):
    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    if not smtp_user or not smtp_password:
        print("[Email Alert] Skipped. SMTP_USER or SMTP_PASSWORD not configured in environment.")
        return False

    try:
        from email.mime.image import MIMEImage
        
        if chart_bytes:
            msg = MIMEMultipart("related")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = recipient_email
            
            msg_alt = MIMEMultipart("alternative")
            msg.attach(msg_alt)
            
            part = MIMEText(html_content, "html")
            msg_alt.attach(part)
            
            img = MIMEImage(chart_bytes)
            img.add_header('Content-ID', '<payoff_chart>')
            img.add_header('Content-Disposition', 'inline', filename='payoff_chart.png')
            msg.attach(img)
        else:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = smtp_user
            msg["To"] = recipient_email
            
            part = MIMEText(html_content, "html")
            msg.attach(part)

        # Connect, upgrade to secure TLS, and login
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, recipient_email, msg.as_string())
        server.quit()
        print(f"[Email Alert] Sent successfully to {recipient_email}")
        return True
    except Exception as e:
        print(f"[Email Alert] Error sending email: {str(e)}")
        return False

def get_currency_symbol_py(symbol: str) -> str:
    sym = symbol.upper()
    if sym in ["SPY", "AAPL", "MSFT", "TSLA", "BTC", "ETH", "SOL", "XRP", "LINK", "AVAX", "LTC", "BNB", "ADA"]:
        return "$"
    return "₹"

def generate_payoff_svg(legs: list, spot_price: float, symbol: str) -> str:
    if not legs or not spot_price:
        return ""
        
    try:
        cur = get_currency_symbol_py(symbol)
        import numpy as np
        
        strikes = [float(leg["strike"]) for leg in legs if leg.get("strike") is not None and leg.get("optionType") != 'F']
        min_strike = min(strikes) if strikes else spot_price
        max_strike = max(strikes) if strikes else spot_price
        
        price_range = max_strike - min_strike
        buffer = max(spot_price * 0.05, price_range * 0.3)
        x_min = max(1.0, min_strike - buffer)
        x_max = max_strike + buffer
        
        points = []
        num_points = 50
        step = (x_max - x_min) / (num_points - 1)
        for i in range(num_points):
            x = x_min + i * step
            pnl = 0.0
            for leg in legs:
                strike = float(leg.get("strike") or 0.0)
                qty = float(leg["quantity"])
                entry_price = float(leg["entryPrice"])
                opt_type = leg["optionType"]
                action = leg["action"]
                
                if opt_type == 'C':
                    val = max(0.0, x - strike)
                elif opt_type == 'P':
                    val = max(0.0, strike - x)
                elif opt_type == 'F':
                    val = x
                else:
                    val = 0.0
                    
                if action == 'BUY':
                    pnl += (val - entry_price) * qty
                else:
                    pnl += (entry_price - val) * qty
            points.append((x, pnl))
            
        pnl_vals = [p[1] for p in points]
        pnl_min = min(pnl_vals)
        pnl_max = max(pnl_vals)
        pnl_range = pnl_max - pnl_min
        if pnl_range == 0:
            pnl_range = 100.0
            
        pnl_min_padded = pnl_min - pnl_range * 0.1
        pnl_max_padded = pnl_max + pnl_range * 0.1
        
        svg_width = 500
        svg_height = 180
        padding_x = 30
        padding_y = 25
        
        def map_x(price):
            return padding_x + (price - x_min) / (x_max - x_min) * (svg_width - 2 * padding_x)
            
        def map_y(pnl):
            return svg_height - (padding_y + (pnl - pnl_min_padded) / (pnl_max_padded - pnl_min_padded) * (svg_height - 2 * padding_y))
            
        path_data = "M" + " L".join(f"{map_x(pt[0]):.1f} {map_y(pt[1]):.1f}" for pt in points)
        y_zero = map_y(0.0)
        y_zero = max(padding_y, min(svg_height - padding_y, y_zero))
        x_spot = map_x(spot_price)
        
        # Calculate current spot PnL for marker dot
        pnl_at_spot = 0.0
        for leg in legs:
            strike = float(leg.get("strike") or 0.0)
            qty = float(leg["quantity"])
            entry_price = float(leg["entryPrice"])
            opt_type = leg["optionType"]
            action = leg["action"]
            
            if opt_type == 'C':
                val = max(0.0, spot_price - strike)
            elif opt_type == 'P':
                val = max(0.0, strike - spot_price)
            elif opt_type == 'F':
                val = spot_price
            else:
                val = 0.0
                
            if action == 'BUY':
                pnl_at_spot += (val - entry_price) * qty
            else:
                pnl_at_spot += (entry_price - val) * qty
                
        y_spot = map_y(pnl_at_spot)
        
        # Label alignment
        y_zero_label = y_zero - 6 if y_zero > 30 else y_zero + 12
        
        # Generate circles for strikes dynamically
        strike_circles = ""
        for strk in strikes:
            strike_circles += f'<circle cx="{map_x(strk):.1f}" cy="{map_y(0.0):.1f}" r="3" fill="#8b949e" opacity="0.4" />'
        
        svg = f"""
        <div style="margin-top: 20px; background-color: #0d1117; padding: 15px; border-radius: 8px; border: 1px solid #30363d; text-align: center;">
          <div style="font-size: 12px; font-weight: bold; color: #8b949e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Strategy Payoff Profile at Expiry</div>
          <svg width="100%" height="{svg_height}" viewBox="0 0 {svg_width} {svg_height}" xmlns="http://www.w3.org/2000/svg">
            <!-- Background grid lines -->
            <line x1="{padding_x}" y1="{padding_y}" x2="{svg_width - padding_x}" y2="{padding_y}" stroke="#161b22" stroke-width="1" />
            <line x1="{padding_x}" y1="{svg_height - padding_y}" x2="{svg_width - padding_x}" y2="{svg_height - padding_y}" stroke="#161b22" stroke-width="1" />
            
            <!-- Zero PnL Reference Line -->
            <line x1="{padding_x}" y1="{y_zero:.1f}" x2="{svg_width - padding_x}" y2="{y_zero:.1f}" stroke="#30363d" stroke-width="1.5" stroke-dasharray="4,4" />
            <text x="{padding_x + 5}" y="{y_zero_label:.1f}" fill="#8b949e" font-size="9" font-family="Arial, sans-serif">Break-Even ({cur}0)</text>
            
            <!-- Current Spot Line -->
            <line x1="{x_spot:.1f}" y1="{padding_y}" x2="{x_spot:.1f}" y2="{svg_height - padding_y}" stroke="#ff9800" stroke-width="1" opacity="0.6" />
            <text x="{x_spot:.1f}" y="{padding_y - 8}" fill="#ff9800" font-size="9" font-family="Arial, sans-serif" text-anchor="middle" font-weight="bold">Spot: {cur}{spot_price:,.2f}</text>
            
            <!-- Payoff curve path -->
            <path d="{path_data}" fill="none" stroke="#58a6ff" stroke-width="2.5" />
            
            <!-- Marker dot for PnL at current Spot -->
            <circle cx="{x_spot:.1f}" cy="{y_spot:.1f}" r="5.5" fill="#ff9800" stroke="#0d1117" stroke-width="2" />
            
            <!-- Strike boundary markers -->
            {strike_circles}
            
            <!-- Axis Limits -->
            <text x="{padding_x}" y="{svg_height - 8}" fill="#8b949e" font-size="9" font-family="Arial, sans-serif">{cur}{x_min:,.1f}</text>
            <text x="{svg_width - padding_x}" y="{svg_height - 8}" fill="#8b949e" font-size="9" font-family="Arial, sans-serif" text-anchor="end">{cur}{x_max:,.1f}</text>
          </svg>
        </div>
        """
        return svg
    except Exception as e:
        print(f"[SVG Gen] Error generating payoff diagram: {e}")
        return ""

def generate_payoff_png(legs: list, spot_price: float, symbol: str) -> bytes:
    if not legs or not spot_price:
        return b""
    try:
        import io
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt
        import numpy as np

        strikes = [float(leg["strike"]) for leg in legs if leg.get("strike") is not None and leg.get("optionType") != 'F']
        min_strike = min(strikes) if strikes else spot_price
        max_strike = max(strikes) if strikes else spot_price
        
        price_range = max_strike - min_strike
        buffer = max(spot_price * 0.05, price_range * 0.3)
        x_min = max(1.0, min_strike - buffer)
        x_max = max_strike + buffer
        
        x_vals = np.linspace(x_min, x_max, 100)
        y_vals = []
        for x in x_vals:
            pnl = 0.0
            for leg in legs:
                strike = float(leg.get("strike") or 0.0)
                qty = float(leg["quantity"])
                entry_price = float(leg["entryPrice"])
                opt_type = leg["optionType"]
                action = leg["action"]
                
                if opt_type == 'C':
                    val = max(0.0, x - strike)
                elif opt_type == 'P':
                    val = max(0.0, strike - x)
                elif opt_type == 'F':
                    val = x
                else:
                    val = 0.0
                    
                if action == 'BUY':
                    pnl += (val - entry_price) * qty
                else:
                    pnl += (entry_price - val) * qty
            y_vals.append(pnl)
            
        # Calculate current spot P&L
        pnl_at_spot = 0.0
        for leg in legs:
            strike = float(leg.get("strike") or 0.0)
            qty = float(leg["quantity"])
            entry_price = float(leg["entryPrice"])
            opt_type = leg["optionType"]
            action = leg["action"]
            
            if opt_type == 'C':
                val = max(0.0, spot_price - strike)
            elif opt_type == 'P':
                val = max(0.0, strike - spot_price)
            elif opt_type == 'F':
                val = spot_price
            else:
                val = 0.0
                
            if action == 'BUY':
                pnl_at_spot += (val - entry_price) * qty
            else:
                pnl_at_spot += (entry_price - val) * qty

        # Create plot
        fig, ax = plt.subplots(figsize=(6, 2.5), facecolor='#0d1117')
        ax.set_facecolor('#0d1117')
        
        # Plot zero reference line
        ax.axhline(0, color='#30363d', linestyle='--', linewidth=1)
        
        # Plot payoff curve
        ax.plot(x_vals, y_vals, color='#58a6ff', linewidth=2.5)
        
        # Plot current spot marker
        ax.axvline(spot_price, color='#ff9800', linestyle='-', linewidth=1.2, alpha=0.8)
        ax.plot(spot_price, pnl_at_spot, marker='o', color='#ff9800', markersize=7, markeredgecolor='#0d1117', markeredgewidth=1.5)
        
        # Style spines and grid
        ax.spines['bottom'].set_color('#30363d')
        ax.spines['top'].set_color('#30363d')
        ax.spines['left'].set_color('#30363d')
        ax.spines['right'].set_color('#30363d')
        ax.tick_params(colors='#8b949e', labelsize=8)
        ax.grid(True, color='#161b22', linestyle=':', linewidth=0.5)
        
        # Format labels
        cur = get_currency_symbol_py(symbol)
        ax.xaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda x, p: f"{cur}{int(x):,}"))
        ax.yaxis.set_major_formatter(matplotlib.ticker.FuncFormatter(lambda x, p: f"{cur}{int(x):,}"))
        
        plt.tight_layout()
        
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
        plt.close(fig)
        
        return buf.getvalue()
    except Exception as e:
        print(f"[PNG Gen] Error generating payoff diagram: {e}")
        return b""

def generate_layman_analysis(strategy_name: str, symbol: str, spot_price: float, legs: list, pop: float) -> str:
    strategy_upper = strategy_name.upper()
    cur = get_currency_symbol_py(symbol)
    
    # 1. Strategy description
    if "IRON CONDOR" in strategy_upper:
        desc = (
            "This is an <b>income-generating neutral strategy</b>. "
            "It is designed to profit as long as the market stays relatively stable within a specific target range. "
            "You collect a premium upfront, and as time passes (Theta decay), the option values shrink, allowing you to keep the profit."
        )
    elif "IRON BUTTERFLY" in strategy_upper or "FLY" in strategy_upper:
        desc = (
            "This is a <b>highly targeted neutral strategy</b>. "
            "It yields its maximum profit if the market price expires exactly at the center strike price. "
            "It features very low risk and a high reward potential, but requires the market to stay close to the center target."
        )
    elif "STRANGLE" in strategy_upper:
        desc = (
            "This is a <b>neutral decay strategy</b>. "
            "You are selling premium far outside both sides of the market. "
            "It has a very high probability of success (POP) because the market has to make a massive, unexpected move to breach your boundaries."
        )
    elif "SPREAD" in strategy_upper:
        if "BULL" in strategy_upper or "PUT" in strategy_upper:
            desc = (
                "This is a <b>hedged directional strategy</b>. "
                "You profit if the market stays flat or moves upward. Your risk is strictly capped by the protective option you bought."
            )
        else:
            desc = (
                "This is a <b>hedged bearish strategy</b>. "
                "You profit if the market stays flat or falls. Your risk is strictly capped by the protective option you bought."
            )
    else:
        desc = (
            "This is a <b>risk-managed options spread</b>. "
            "It combines sold options (to collect premium and profit from time decay) with bought options (to protect you against unexpected market spikes)."
        )
        
    # 2. Strike levels and profitable range
    strikes = [float(leg["strike"]) for leg in legs if leg.get("strike") is not None and leg.get("optionType") != 'F']
    if strikes:
        strikes = sorted(list(set(strikes)))
        if len(strikes) >= 4:
            lower_be = strikes[1] # Approximate lower break-even
            upper_be = strikes[2] # Approximate upper break-even
            range_text = (
                f"Your primary target zone is between <b>{cur}{lower_be:,}</b> and <b>{cur}{upper_be:,}</b>. "
                f"If the underlying asset price stays inside this target boundary until expiry, the strategy will achieve positive returns."
            )
        else:
            range_text = (
                f"Your profit boundaries are defined around the strike prices: " + 
                ", ".join(f"<b>{cur}{s:,}</b>" for s in strikes) + ". "
                f"The strategy is optimized to succeed based on these price milestones."
            )
    else:
        range_text = "The strategy profit zone is dynamically tied to the underlying spot price movement."

    # 3. Probability of Success
    pop_interpretation = ""
    if pop >= 75:
        pop_interpretation = (
            f"With a POP (Probability of Profit) of <b>{pop}%</b>, this trade has a <b>very high statistical chance of finishing in profit</b>. "
            "It is highly suitable for conservative income seekers."
        )
    elif pop >= 60:
        pop_interpretation = (
            f"With a POP of <b>{pop}%</b>, this trade has a <b>solid probability of success</b>. "
            "It balances risk and reward effectively."
        )
    else:
        pop_interpretation = (
            f"With a POP of <b>{pop}%</b>, this is a <b>tactical, lower-probability trade</b> that offers a higher payout if the market moves exactly in your favor."
        )

    analysis_html = f"""
    <div style="margin-top: 20px; padding: 20px; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; font-size: 13px; line-height: 1.6; text-align: left;">
      <h3 style="color: #ff9800; font-size: 14px; margin-top: 0; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #21262d; padding-bottom: 6px;">💡 Layman Strategy Analysis</h3>
      <p style="margin: 0 0 10px 0; color: #c9d1d9;"><b>What this strategy does:</b> {desc}</p>
      <p style="margin: 0 0 10px 0; color: #c9d1d9;"><b>Profitable Range:</b> {range_text}</p>
      <p style="margin: 0; color: #c9d1d9;"><b>Probability of Success:</b> {pop_interpretation}</p>
    </div>
    """
    return analysis_html

@router.post("/trigger-alert")
async def trigger_alert(
    data: TriggerAlertSchema, 
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Save triggered alert to database persistently
    import uuid
    from app.db.models import TriggeredAlert
    db_triggered = TriggeredAlert(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        symbol=data.symbol,
        strategy_name=data.strategy_name,
        expiry=data.expiry,
        pop=data.pop,
        max_profit=data.max_profit,
        max_loss=data.max_loss,
        rr_ratio=data.rr_ratio,
        timestamp=data.timestamp,
        current_pnl=data.current_pnl,
        spot_price=data.spot_price,
        legs=data.legs or [],
        rule_id=None
    )
    db.add(db_triggered)
    await db.commit()

    cur = get_currency_symbol_py(data.symbol)
    
    # 1. Format SMS / standard text message
    spot_price_text = f"\nSpot Price: {cur}{data.spot_price:,.2f}" if data.spot_price is not None else ""
    text_message = (
        f"🔔 OptionsOracle Alert!\n"
        f"Strategy: {data.strategy_name}\n"
        f"Symbol: {data.symbol}\n"
        f"Expiry: {data.expiry}\n"
        f"POP: {data.pop}%\n"
        f"R:R: 1:{data.rr_ratio:.1f}\n"
        f"Max Loss: {data.max_loss}\n"
        f"Current P&L: {data.current_pnl}"
        f"{spot_price_text}\n"
        f"Time: {data.timestamp}"
    )

    # 2. Format HTML Telegram / Email message
    telegram_html = (
        f"<b>🔔 OptionsOracle Scanner Alert!</b>\n\n"
        f"📈 <b>Symbol:</b> {data.symbol}\n"
        f"📅 <b>Expiry:</b> {data.expiry}\n"
        f"💼 <b>Strategy:</b> {data.strategy_name}\n"
        f"🎯 <b>Probability of Profit:</b> {data.pop}%\n"
        f"⚖️ <b>Risk:Reward:</b> 1:{data.rr_ratio:.1f}\n"
        f"⚠️ <b>Max Loss:</b> {data.max_loss}\n"
        f"💵 <b>Max Profit:</b> {data.max_profit}\n"
        f"💰 <b>Current P&L:</b> {data.current_pnl}\n"
    )
    if data.spot_price is not None:
        telegram_html += f"📊 <b>Spot Price:</b> {cur}{data.spot_price:,.2f}\n"
    telegram_html += f"⏰ <b>Triggered:</b> {data.timestamp}"

    # Generate layman strategy analysis
    layman_analysis_html = ""
    if data.legs and data.spot_price is not None:
        layman_analysis_html = generate_layman_analysis(data.strategy_name, data.symbol, data.spot_price, data.legs, data.pop)

    # Generate payoff diagram diagram/bytes
    chart_bytes = None
    payoff_diagram_html = ""
    if data.legs and data.spot_price is not None:
        if data.channel == "email":
            chart_bytes = generate_payoff_png(data.legs, data.spot_price, data.symbol)
            # Reference the attached image via CID
            payoff_diagram_html = """
            <div style="margin-top: 20px; background-color: #0d1117; padding: 15px; border-radius: 8px; border: 1px solid #30363d; text-align: center;">
              <div style="font-size: 12px; font-weight: bold; color: #8b949e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 1px;">Strategy Payoff Profile at Expiry</div>
              <img src="cid:payoff_chart" alt="Strategy Payoff Chart" style="max-width: 100%; height: auto; border: 1px solid #30363d; border-radius: 8px;" />
            </div>
            """
        else:
            payoff_diagram_html = generate_payoff_svg(data.legs, data.spot_price, data.symbol)

    # Email HTML markup styling
    email_html = f"""
    <html>
      <body style="font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2 style="color: #ff9800; border-bottom: 2px solid #30363d; padding-bottom: 10px; margin-top: 0;">🔔 OptionsOracle Scanner Alert</h2>
          <p style="font-size: 15px; line-height: 1.6;">We found a strategy matching your scanning criteria:</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Symbol</td>
              <td style="padding: 10px 0; font-weight: bold; color: #58a6ff;">{data.symbol}</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Strategy</td>
              <td style="padding: 10px 0; color: #ffffff;">{data.strategy_name}</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Expiry</td>
              <td style="padding: 10px 0; color: #ffffff;">{data.expiry}</td>
            </tr>
    """
    
    if data.spot_price is not None:
        email_html += f"""
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Underlying Price</td>
              <td style="padding: 10px 0; color: #ff9800; font-weight: bold;">{cur}{data.spot_price:,.2f}</td>
            </tr>
        """
        
    email_html += f"""
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Probability of Profit (POP)</td>
              <td style="padding: 10px 0; color: #4caf50; font-weight: bold;">{data.pop}%</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Risk:Reward Ratio</td>
              <td style="padding: 10px 0; color: #ffffff;">1:{data.rr_ratio:.1f}</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Max Loss</td>
              <td style="padding: 10px 0; color: #f44336; font-weight: bold;">{data.max_loss}</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Max Profit</td>
              <td style="padding: 10px 0; color: #4caf50; font-weight: bold;">{data.max_profit}</td>
            </tr>
            <tr style="border-bottom: 1px solid #21262d;">
              <td style="padding: 10px 0; font-weight: bold; color: #8b949e;">Current P&L (Entered at Alert)</td>
              <td style="padding: 10px 0; color: #ff9800; font-weight: bold;">{data.current_pnl}</td>
            </tr>
          </table>
          
          {payoff_diagram_html}

          {layman_analysis_html}
          
          <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #30363d; font-size: 11px; color: #8b949e; text-align: center;">
            OptionsOracle System • Triggered at {data.timestamp}
          </div>
        </div>
      </body>
    </html>
    """

    status_info = {}

    # 3. Dispatch alert based on selected channel
    if data.channel in ("sms", "both"):
        target_phone = data.phone_number or current_user.phone_number
        sms_sent = send_alert_sms(target_phone, text_message)
        status_info["sms"] = "sent" if sms_sent else "mocked/failed"

    if data.channel in ("telegram", "both"):
        tg_sent = await send_alert_telegram(data.telegram_bot_token, data.telegram_chat_id, telegram_html)
        status_info["telegram"] = "sent" if tg_sent else "failed"

    if data.channel == "whatsapp":
        target_wa = data.whatsapp_number or current_user.phone_number
        wa_sent = send_alert_whatsapp(target_wa, text_message)
        status_info["whatsapp"] = "sent" if wa_sent else "mocked/failed"

    if data.channel == "email":
        target_email = data.recipient_email
        if not target_email:
            raise HTTPException(status_code=400, detail="Recipient email address is required for email alerts")
        email_sent = send_alert_email(target_email, f"🔔 OptionsOracle Alert: {data.symbol} - {data.strategy_name}", email_html, chart_bytes)
        status_info["email"] = "sent" if email_sent else "failed"

    return {
        "status": "success",
        "channel": data.channel,
        "dispatched": status_info
    }
