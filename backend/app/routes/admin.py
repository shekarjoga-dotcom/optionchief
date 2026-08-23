import hashlib
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.db.session import get_db
from app.db.models import User, Portfolio, AlertRule, RSIScannerLog, BroadcastLog, PageVisit
from app.routes.auth import get_current_user, get_user_subscription_info

router = APIRouter(prefix="/api/admin", tags=["admin"])

def check_super_admin(user: User):
    if user.role.lower() not in ["owner", "admin"] and user.id != 1:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Owner/Admin privileges required."
        )

class AdminUserResponse(BaseModel):
    id: int
    phone_number: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    role: str
    subscription_tier: str
    plan_name: str
    is_pro: bool
    is_trial: bool
    days_left: int
    status: str
    trial_ends_at: Optional[str] = None
    subscription_ends_at: Optional[str] = None
    is_auto_scanning: bool
    created_at: str
    dhan_client_id: Optional[str] = None
    has_dhan_token: bool = False

@router.get("/users", response_model=List[AdminUserResponse])
async def list_all_users(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    result = await db.execute(select(User).order_by(User.id.asc()))
    users = result.scalars().all()
    
    response = []
    for u in users:
        sub_info = get_user_subscription_info(u)
        response.append(AdminUserResponse(
            id=u.id,
            phone_number=u.phone_number,
            email=u.email,
            display_name=u.display_name,
            role=u.role,
            subscription_tier=sub_info["tier"],
            plan_name=sub_info["plan_name"],
            is_pro=sub_info["is_pro"],
            is_trial=sub_info["is_trial"],
            days_left=sub_info["days_left"],
            status=sub_info["status"],
            trial_ends_at=sub_info["trial_ends_at"],
            subscription_ends_at=sub_info["subscription_ends_at"],
            is_auto_scanning=u.is_auto_scanning,
            created_at=u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
            dhan_client_id=u.dhan_client_id,
            has_dhan_token=bool(u.dhan_access_token)
        ))
    return response

class SubscriptionUpdateSchema(BaseModel):
    plan_type: str  # "trial_15", "pro_1mo", "pro_6mo", "pro_1yr", "owner", "free"

@router.put("/users/{user_id}/subscription")
async def update_user_subscription(
    user_id: int,
    data: SubscriptionUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    now = datetime.utcnow()
    plan_type = data.plan_type.lower()
    
    if plan_type == "trial_15":
        target_user.subscription_tier = "trial"
        target_user.plan_name = "15-Day Free Trial"
        target_user.trial_ends_at = now + timedelta(days=15)
        target_user.subscription_ends_at = None
    elif plan_type == "pro_1mo":
        target_user.subscription_tier = "pro"
        target_user.plan_name = "1 Month Pro (₹499)"
        target_user.subscription_ends_at = now + timedelta(days=30)
    elif plan_type == "pro_6mo":
        target_user.subscription_tier = "pro"
        target_user.plan_name = "6 Months Pro (₹2,499)"
        target_user.subscription_ends_at = now + timedelta(days=180)
    elif plan_type == "pro_1yr":
        target_user.subscription_tier = "pro"
        target_user.plan_name = "1 Year Pro (₹4,499)"
        target_user.subscription_ends_at = now + timedelta(days=365)
    elif plan_type == "owner":
        target_user.role = "owner"
        target_user.subscription_tier = "owner"
        target_user.plan_name = "Lifetime Owner"
    elif plan_type == "free":
        target_user.subscription_tier = "free"
        target_user.plan_name = "Free / Expired Plan"
        target_user.trial_ends_at = now - timedelta(days=1)
        target_user.subscription_ends_at = None
    else:
        raise HTTPException(status_code=400, detail="Invalid plan type")
        
    await db.commit()
    await db.refresh(target_user)
    return {
        "status": "success",
        "message": f"Updated subscription for {target_user.phone_number or target_user.email} to {target_user.plan_name}",
        "user_id": target_user.id
    }

@router.put("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    target_user.role = role.lower()
    await db.commit()
    await db.refresh(target_user)
    return {"status": "success", "message": f"User role updated to {target_user.role}"}

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    if current_user.id == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own Owner account")
        
    target_user = await db.get(User, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.delete(target_user)
    await db.commit()
    return {"status": "success", "message": "User account deleted successfully"}

class BroadcastRequestSchema(BaseModel):
    subject: str
    message: str
    channels: List[str] = ["telegram", "whatsapp"] # "telegram", "whatsapp", "email"
    target_audience: str = "all" # "all", "trial", "expired", "pro"

@router.post("/broadcast/send")
async def send_broadcast(
    data: BroadcastRequestSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    
    # Query audience
    users_query = select(User).order_by(User.id.asc())
    all_users = (await db.execute(users_query)).scalars().all()
    
    now = datetime.utcnow()
    target_recipients = []
    for u in all_users:
        sub = get_user_subscription_info(u)
        if data.target_audience == "all":
            target_recipients.append(u)
        elif data.target_audience == "trial" and sub["is_trial"]:
            target_recipients.append(u)
        elif data.target_audience == "pro" and sub["tier"] == "pro":
            target_recipients.append(u)
        elif data.target_audience == "expired" and sub["tier"] == "free":
            target_recipients.append(u)
            
    recipient_count = len(target_recipients)
    
    # 1. Telegram Dispatch
    telegram_sent = False
    if "telegram" in data.channels:
        try:
            from app.services.telegram_bot import send_telegram_alert
            formatted_msg = f"📢 *[OptionChief Broadcast]*\n\n*{data.subject}*\n\n{data.message}"
            telegram_sent = await send_telegram_alert(formatted_msg)
        except Exception as e:
            print(f"[Broadcast Telegram Error] {e}")
            
    # 2. WhatsApp Direct Link Previews generated for recipient list with valid phone numbers
    whatsapp_links = []
    if "whatsapp" in data.channels:
        import urllib.parse
        encoded_text = urllib.parse.quote(f"*[OptionChief Update]*\n\n*{data.subject}*\n\n{data.message}\n\n👉 Login: https://optionchief.in")
        for u in target_recipients:
            clean_num = (u.phone_number or "").replace("+", "").replace(" ", "").replace("-", "")
            if clean_num.isdigit() and len(clean_num) >= 10:
                whatsapp_links.append({
                    "user_id": u.id,
                    "phone": u.phone_number,
                    "name": u.display_name or u.phone_number,
                    "link": f"https://wa.me/{clean_num}?text={encoded_text}"
                })

    # 3. Email Dispatch via SMTP & 1-Click Mailto Previews for all email accounts
    email_dispatched_count = 0
    email_links = []
    if "email" in data.channels:
        import urllib.parse
        from app.routes.notifications import send_alert_email

        html_content = f"""
        <html>
          <body style="font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 25px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
              <div style="text-align: center; border-bottom: 2px solid #30363d; padding-bottom: 15px; margin-bottom: 20px;">
                <h1 style="color: #38bdf8; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px;">OptionChief</h1>
                <span style="font-size: 12px; color: #8b949e;">Options Strategy & Execution Terminal</span>
              </div>
              <h2 style="color: #ff9800; margin-top: 0; font-size: 18px;">{data.subject}</h2>
              <div style="font-size: 14px; line-height: 1.6; color: #e6edf3; white-space: pre-line; background-color: #0d1117; padding: 15px; border-radius: 8px; border: 1px solid #21262d;">
                {data.message}
              </div>
              <div style="text-align: center; margin-top: 25px;">
                <a href="https://optionchief.in" style="background-color: #0284c7; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                  Open OptionChief Terminal ➔
                </a>
              </div>
              <div style="margin-top: 25px; padding-top: 15px; border-top: 1px solid #30363d; font-size: 11px; color: #8b949e; text-align: center;">
                OptionChief • Sent to registered subscriber
              </div>
            </div>
          </body>
        </html>
        """

        encoded_subject = urllib.parse.quote(f"[OptionChief] {data.subject}")
        encoded_body = urllib.parse.quote(f"{data.message}\n\n👉 Login: https://optionchief.in")

        for u in target_recipients:
            target_email = u.email
            if not target_email and "@" in (u.phone_number or ""):
                target_email = u.phone_number

            if target_email and "@" in target_email and not target_email.endswith("@optionchief.in"):
                gmail_url = f"https://mail.google.com/mail/?view=cm&fs=1&to={urllib.parse.quote(target_email)}&su={encoded_subject}&body={encoded_body}"
                mailto_url = f"mailto:{target_email}?subject={encoded_subject}&body={encoded_body}"
                email_links.append({
                    "user_id": u.id,
                    "name": u.display_name or target_email.split('@')[0],
                    "email": target_email,
                    "link": gmail_url,
                    "gmail_link": gmail_url,
                    "mailto_link": mailto_url
                })
                # Attempt direct SMTP dispatch
                try:
                    sent = send_alert_email(target_email, f"[OptionChief] {data.subject}", html_content)
                    if sent:
                        email_dispatched_count += 1
                except Exception as ex:
                    print(f"[Broadcast Email Error to {target_email}]: {ex}")

    # 4. Log broadcast to database
    log = BroadcastLog(
        subject=data.subject,
        message=data.message,
        channels=data.channels,
        target_audience=data.target_audience,
        recipient_count=recipient_count,
        sent_by_user_id=current_user.id
    )
    db.add(log)
    await db.commit()
    
    return {
        "status": "success",
        "message": f"Broadcast processed for {recipient_count} subscribers (Dispatched {email_dispatched_count} emails via SMTP).",
        "recipient_count": recipient_count,
        "telegram_dispatched": telegram_sent,
        "email_dispatched_count": email_dispatched_count,
        "email_links": email_links,
        "whatsapp_preview_count": len(whatsapp_links),
        "whatsapp_links": whatsapp_links
    }

@router.post("/broadcast/trial-reminders")
async def send_trial_expiry_reminders(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    
    users = (await db.execute(select(User))).scalars().all()
    
    expiring_users = []
    for u in users:
        sub = get_user_subscription_info(u)
        if sub["is_pro"] and sub["days_left"] <= 3 and sub["days_left"] >= 0:
            expiring_users.append({
                "user": u,
                "days_left": sub["days_left"],
                "plan": sub["plan_name"]
            })
            
    if not expiring_users:
        return {
            "status": "success",
            "message": "No subscribers currently have trials expiring in <= 3 days.",
            "count": 0,
            "reminders": []
        }
        
    import urllib.parse
    from app.routes.notifications import send_alert_email

    reminder_links = []
    for item in expiring_users:
        u = item["user"]
        days = item["days_left"]
        msg = f"⏳ OptionChief Reminder: Your {item['plan']} expires in {days} day{'s' if days != 1 else ''}!\n\nRenew your plan (1 Mo @ ₹499 | 6 Mos @ ₹2,499 | 1 Yr @ ₹4,499) to maintain 24/7 real-time Regime Ratio Fly and Iron Condor alerts.\n\n👉 Upgrade: https://optionchief.in"
        encoded = urllib.parse.quote(msg)
        
        # WhatsApp link for phone number
        clean_num = (u.phone_number or "").replace("+", "").replace(" ", "").replace("-", "")
        wa_link = f"https://wa.me/{clean_num}?text={encoded}" if (clean_num.isdigit() and len(clean_num) >= 10) else None

        # Email link / dispatch
        target_email = u.email if (u.email and "@" in u.email) else (u.phone_number if "@" in (u.phone_number or "") else None)
        mail_link = f"https://mail.google.com/mail/?view=cm&fs=1&to={urllib.parse.quote(target_email)}&su={urllib.parse.quote('OptionChief Trial Expiration Reminder')}&body={encoded}" if target_email else None

        # Try automatic SMTP dispatch
        if target_email:
            try:
                email_html = f"""
                <div style="font-family: Arial, sans-serif; background-color: #0d1117; color: #c9d1d9; padding: 20px;">
                  <div style="max-width: 550px; margin: 0 auto; background-color: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 20px;">
                    <h2 style="color: #f59e0b; margin-top: 0;">⏳ OptionChief Access Expiring</h2>
                    <p style="font-size: 14px; line-height: 1.6;">Your <strong>{item['plan']}</strong> has <strong>{days} day{'s' if days != 1 else ''} remaining</strong>.</p>
                    <p style="font-size: 13px; color: #8b949e;">Renew now to keep unlimited access to 1:3:2 Ratio Scanners, live Greeks, and Telegram push alerts.</p>
                    <div style="text-align: center; margin: 25px 0;">
                      <a href="https://optionchief.in" style="background-color: #0284c7; color: #ffffff; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">Renew Subscription (₹499/mo) ➔</a>
                    </div>
                  </div>
                </div>
                """
                send_alert_email(target_email, "⏳ OptionChief: Your Access is Expiring Soon", email_html)
            except Exception as ex:
                print(f"[Reminder Email Error to {target_email}]: {ex}")

        reminder_links.append({
            "user_id": u.id,
            "phone": u.phone_number or target_email,
            "email": target_email,
            "name": u.display_name or (target_email or u.phone_number),
            "days_left": days,
            "whatsapp_link": wa_link,
            "email_link": mail_link
        })
            
    return {
        "status": "success",
        "message": f"Generated reminders for {len(expiring_users)} subscribers with <= 3 days left.",
        "count": len(expiring_users),
        "reminders": reminder_links
    }

class VisitTrackSchema(BaseModel):
    path: Optional[str] = "/"

@router.post("/track-visit")
async def track_visit(data: VisitTrackSchema, request: Request, db: AsyncSession = Depends(get_db)):
    try:
        client_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "")
        ip_hash = hashlib.sha256(f"{client_ip}-{user_agent[:50]}".encode('utf-8')).hexdigest()[:16]
        
        visit = PageVisit(
            visitor_hash=ip_hash,
            path=data.path or "/",
            user_agent=user_agent[:100]
        )
        db.add(visit)
        await db.commit()
        return {"status": "ok"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}

@router.get("/system-stats")
async def get_system_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    portfolio_count = (await db.execute(select(func.count(Portfolio.id)))).scalar() or 0
    rule_count = (await db.execute(select(func.count(AlertRule.id)))).scalar() or 0
    rsi_log_count = (await db.execute(select(func.count(RSIScannerLog.id)))).scalar() or 0
    broadcast_count = (await db.execute(select(func.count(BroadcastLog.id)))).scalar() or 0

    total_visitors = (await db.execute(select(func.count(func.distinct(PageVisit.visitor_hash))))).scalar() or 0
    today_visitors = (await db.execute(select(func.count(func.distinct(PageVisit.visitor_hash))).where(PageVisit.created_at >= today_start))).scalar() or 0
    total_pageviews = (await db.execute(select(func.count(PageVisit.id)))).scalar() or 0
    
    return {
        "total_users": user_count,
        "total_visitors": total_visitors,
        "today_visitors": today_visitors,
        "total_pageviews": total_pageviews,
        "total_portfolios": portfolio_count,
        "active_alert_rules": rule_count,
        "rsi_scanner_logs": rsi_log_count,
        "broadcast_messages_sent": broadcast_count
    }

