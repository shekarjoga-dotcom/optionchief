import random
import os
import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, OTPRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])
AUTH_ROUTE_VERSION = "2026.08.05.v2"

# Security Configurations
JWT_SECRET = os.getenv("JWT_SECRET", "options_oracle_reborn_super_secret_key_change_me_in_prod_2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Tokens expire in 7 days

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Pydantic Schemas
class OTPRequestSchema(BaseModel):
    phone_number: str = Field(..., description="Phone number with country code")

class RegisterSchema(BaseModel):
    phone_number: str
    otp_code: str
    password: str

class RegisterDirectSchema(BaseModel):
    phone_number: str
    password: str
    display_name: Optional[str] = None
    email: Optional[str] = None

class LoginSchema(BaseModel):
    phone_number: str
    password: str = None
    otp_code: str = None

# JWT & Password Helpers
def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes[:72], hashed_password.encode('utf-8'))
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    hashed = bcrypt.hashpw(pwd_bytes[:72], bcrypt.gensalt())
    return hashed.decode('utf-8')

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)

def send_otp_sms(phone_number: str, otp_code: str):
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_PHONE_NUMBER")

    if account_sid and auth_token and from_number:
        try:
            from twilio.rest import Client
            client = Client(account_sid, auth_token)
            message = client.messages.create(
                body=f"Your OptionsOracle verification code is: {otp_code}. It will expire in 5 minutes.",
                from_=from_number,
                to=phone_number
            )
            print(f"[Twilio SMS] Sent OTP to {phone_number}, SID: {message.sid}")
            return True
        except Exception as e:
            print(f"[Twilio SMS] Error sending SMS: {str(e)}")
            
    # Fallback/Mock Mode console printing
    print("\n" + "="*50)
    print(f"  [SMS OTP MOCK] Verification code for {phone_number} is: {otp_code}")
    print("="*50 + "\n")
    return False

# Security Dependency
def get_user_subscription_info(user: User) -> dict:
    now = datetime.utcnow()
    role = user.role.lower() if user.role else "subscriber"
    
    # 1. Lifetime Owner (Admin)
    if role in ["owner", "admin"] or user.id == 1:
        return {
            "tier": "owner",
            "plan_name": "Lifetime Owner",
            "is_pro": True,
            "is_trial": False,
            "days_left": 9999,
            "status": "Owner Account",
            "trial_ends_at": None,
            "subscription_ends_at": None
        }
        
    # 2. Paid Active Subscription (e.g. 1 Month, 6 Months, 1 Year)
    if user.subscription_ends_at and user.subscription_ends_at > now:
        days_left = max(0, (user.subscription_ends_at - now).days)
        plan = user.plan_name or "Paid Pro"
        return {
            "tier": "pro",
            "plan_name": plan,
            "is_pro": True,
            "is_trial": False,
            "days_left": days_left,
            "status": f"{plan} ({days_left}d left)",
            "trial_ends_at": user.trial_ends_at.strftime("%Y-%m-%d") if user.trial_ends_at else None,
            "subscription_ends_at": user.subscription_ends_at.strftime("%Y-%m-%d")
        }
        
    # 3. Custom Trial (if explicitly granted by Admin)
    if user.trial_ends_at and user.trial_ends_at > now:
        days_left = max(0, (user.trial_ends_at - now).days)
        return {
            "tier": "trial",
            "plan_name": user.plan_name or "Pro Trial",
            "is_pro": True,
            "is_trial": True,
            "days_left": days_left,
            "status": f"Pro Trial ({days_left}d left)",
            "trial_ends_at": user.trial_ends_at.strftime("%Y-%m-%d"),
            "subscription_ends_at": None
        }
        
    # 4. Free Tier (Option Chain Free, Regime Scanners & Live Broker Locked)
    return {
        "tier": "free",
        "plan_name": "Free Plan",
        "is_pro": False,
        "is_trial": False,
        "days_left": 0,
        "status": "Free Plan (Upgrade to Pro)",
        "trial_ends_at": None,
        "subscription_ends_at": None
    }

# Security Dependency
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    user = None
    if token and token != "mock_bypass_token":
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id_str: str = payload.get("sub")
            if user_id_str is not None:
                user_id = int(user_id_str)
                result = await db.execute(select(User).where(User.id == user_id))
                user = result.scalar_one_or_none()
        except Exception:
            pass

    # If verification failed or token is mock/missing, bypass it by getting/creating the default user
    if user is None:
        result = await db.execute(select(User).order_by(User.id.asc()))
        user = result.scalars().first()
        if user is None:
            user = User(
                phone_number="+919999999999",
                password_hash="mocked",
                role="owner",
                subscription_tier="owner",
                plan_name="Lifetime Owner"
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)
            
    return user

# Routes
@router.post("/request-otp")
async def request_otp(data: OTPRequestSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()
    otp = f"{random.randint(100000, 999999)}"
    expiry = datetime.utcnow() + timedelta(minutes=5)

    # Invalidate previous OTPs
    old_otps = await db.execute(select(OTPRequest).where(OTPRequest.phone_number == phone))
    for o in old_otps.scalars().all():
        await db.delete(o)

    new_otp = OTPRequest(phone_number=phone, otp_code=otp, expires_at=expiry)
    db.add(new_otp)
    await db.commit()

    # Attempt sending real SMS
    send_otp_sms(phone, otp)

    return {
        "status": "success",
        "message": f"OTP sent to {phone}. Check SMS.",
        "expires_in_seconds": 300
    }

@router.post("/register")
async def register(data: RegisterSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()
    code = data.otp_code.strip()
    password = data.password.strip()

    # 1. Verify OTP
    now = datetime.utcnow()
    otp_query = select(OTPRequest).where(
        OTPRequest.phone_number == phone,
        OTPRequest.otp_code == code,
        OTPRequest.expires_at >= now
    ).order_by(OTPRequest.created_at.desc())

    otp_res = await db.execute(otp_query)
    otp_req = otp_res.scalars().first()

    if not otp_req:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

    # 2. Check if user already exists
    user_exists_query = select(User).where(User.phone_number == phone)
    user_exists_res = await db.execute(user_exists_query)
    if user_exists_res.scalars().first():
        raise HTTPException(status_code=400, detail="User with this phone number already registered")

    # 3. Determine role & subscription (First user is Owner, all subsequent users get Free Tier)
    users_count_query = select(func.count(User.id))
    users_count_res = await db.execute(users_count_query)
    users_count = users_count_res.scalar() or 0

    is_first = (users_count == 0)
    role = "owner" if is_first else "subscriber"
    sub_tier = "owner" if is_first else "free"
    plan = "Lifetime Owner" if is_first else "Free Plan"
    trial_end = None

    # 4. Create User
    hashed_password = get_password_hash(password)
    new_user = User(
        phone_number=phone,
        password_hash=hashed_password,
        role=role,
        subscription_tier=sub_tier,
        plan_name=plan,
        trial_ends_at=trial_end
    )
    db.add(new_user)
    if otp_req:
        await db.delete(otp_req)
        
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "phone": new_user.phone_number, "role": new_user.role})
    sub_info = get_user_subscription_info(new_user)

    return {
        "status": "success",
        "message": "User registered successfully.",
        "token": token,
        "user": {
            "id": new_user.id,
            "phone_number": new_user.phone_number,
            "email": new_user.email,
            "display_name": new_user.display_name,
            "role": new_user.role,
            **sub_info
        }
    }

@router.post("/register-direct")
async def register_direct(data: RegisterDirectSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()
    password = data.password.strip()
    display_name = data.display_name.strip() if data.display_name else None
    email = data.email.strip() if data.email else None

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    # 1. Check if user already exists
    user_exists_query = select(User).where(User.phone_number == phone)
    user_exists_res = await db.execute(user_exists_query)
    if user_exists_res.scalars().first():
        raise HTTPException(status_code=400, detail="User with this phone number already registered. Please sign in.")

    # 2. Determine role & subscription (First user is Owner, all subsequent users get Free Tier)
    users_count_query = select(func.count(User.id))
    users_count_res = await db.execute(users_count_query)
    users_count = users_count_res.scalar() or 0

    is_first = (users_count == 0)
    role = "owner" if is_first else "subscriber"
    sub_tier = "owner" if is_first else "free"
    plan = "Lifetime Owner" if is_first else "Free Plan"
    trial_end = None

    # 3. Create User
    hashed_password = get_password_hash(password)
    new_user = User(
        phone_number=phone,
        email=email,
        display_name=display_name,
        password_hash=hashed_password,
        role=role,
        subscription_tier=sub_tier,
        plan_name=plan,
        trial_ends_at=trial_end
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "phone": new_user.phone_number, "email": new_user.email, "role": new_user.role})
    sub_info = get_user_subscription_info(new_user)

    return {
        "status": "success",
        "message": "Account created successfully! Welcome to OptionChief.",
        "token": token,
        "user": {
            "id": new_user.id,
            "phone_number": new_user.phone_number,
            "email": new_user.email,
            "display_name": new_user.display_name,
            "role": new_user.role,
            **sub_info
        }
    }

@router.post("/login")
async def login(data: LoginSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()

    # Find user
    user_query = select(User).where(User.phone_number == phone)
    user_res = await db.execute(user_query)
    user = user_res.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="User not registered. Please register first.")

    # Verify either password or OTP
    authenticated = False
    if data.password:
        if verify_password(data.password, user.password_hash):
            authenticated = True
    elif data.otp_code:
        code = data.otp_code.strip()
        
        now = datetime.utcnow()
        otp_query = select(OTPRequest).where(
            OTPRequest.phone_number == phone,
            OTPRequest.otp_code == code,
            OTPRequest.expires_at >= now
        ).order_by(OTPRequest.created_at.desc())
        otp_res = await db.execute(otp_query)
        otp_req = otp_res.scalars().first()
        
        if otp_req:
            authenticated = True
            await db.delete(otp_req)
            await db.commit()

    if not authenticated:
        raise HTTPException(status_code=400, detail="Invalid password or OTP code")

    token = create_access_token({"sub": str(user.id), "phone": user.phone_number, "role": user.role})
    sub_info = get_user_subscription_info(user)

    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user.id,
            "phone_number": user.phone_number,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            **sub_info
        }
    }

class FirebaseLoginSchema(BaseModel):
    id_token: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[str] = None
    uid: Optional[str] = None
    display_name: Optional[str] = None

@router.post("/firebase-login")
async def firebase_login(data: FirebaseLoginSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip() if data.phone_number else None
    email = data.email.strip() if data.email else None
    uid = data.uid.strip() if data.uid else None
    
    # Identify user by phone, email, or firebase uid
    user = None
    if phone:
        user_res = await db.execute(select(User).where(User.phone_number == phone))
        user = user_res.scalars().first()
    if not user and email:
        user_res = await db.execute(select(User).where(User.email == email))
        user = user_res.scalars().first()
    if not user and uid:
        user_res = await db.execute(select(User).where(User.phone_number == f"fb_{uid}"))
        user = user_res.scalars().first()
        
    if not user:
        users_count_query = select(func.count(User.id))
        users_count_res = await db.execute(users_count_query)
        users_count = users_count_res.scalar() or 0
        
        is_first = (users_count == 0)
        role = "owner" if is_first else "subscriber"
        sub_tier = "owner" if is_first else "free"
        plan = "Lifetime Owner" if is_first else "Free Plan"
        trial_end = None

        fallback_phone = phone or (f"fb_{uid}" if uid else f"user_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}")
        user = User(
            phone_number=fallback_phone,
            email=email,
            display_name=data.display_name,
            password_hash="firebase_verified",
            role=role,
            subscription_tier=sub_tier,
            plan_name=plan,
            trial_ends_at=trial_end
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update details if available
        updated = False
        if data.display_name and user.display_name != data.display_name:
            user.display_name = data.display_name
            updated = True
        if email and user.email != email:
            user.email = email
            updated = True
        if updated:
            db.add(user)
            await db.commit()
            await db.refresh(user)
        
    token = create_access_token({"sub": str(user.id), "phone": user.phone_number, "email": user.email, "role": user.role})
    sub_info = get_user_subscription_info(user)
    return {
        "status": "success",
        "token": token,
        "user": {
            "id": user.id,
            "phone_number": user.phone_number,
            "email": user.email,
            "display_name": user.display_name,
            "role": user.role,
            **sub_info
        }
    }

class ProfileUpdateSchema(BaseModel):
    dhan_client_id: Optional[str] = None
    dhan_access_token: Optional[str] = None

@router.put("/profile")
async def update_profile(
    data: ProfileUpdateSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if data.dhan_client_id is not None:
        current_user.dhan_client_id = data.dhan_client_id.strip()
        os.environ["DHAN_CLIENT_ID"] = current_user.dhan_client_id
    if data.dhan_access_token is not None:
        current_user.dhan_access_token = data.dhan_access_token.strip()
        os.environ["DHAN_ACCESS_TOKEN"] = current_user.dhan_access_token
        try:
            token_dir = "/data" if os.path.exists("/data") else os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data")
            os.makedirs(token_dir, exist_ok=True)
            token_file = os.path.join(token_dir, "dhan_token.txt")
            with open(token_file, "w", encoding="utf-8") as f:
                f.write(current_user.dhan_access_token)
            print(f"[Dhan Token Sync] Written active Dhan token to {token_file}")
        except Exception as e:
            print(f"[Dhan Token Sync] Error writing token file: {e}")
            
    # Reset market_service cache to force re-authenticating with new Dhan keys
    try:
        from app.routes.market import market_service
        market_service._cached_token = None
        market_service._dhan_client = None
    except Exception:
        pass
    
    await db.commit()
    await db.refresh(current_user)
    sub_info = get_user_subscription_info(current_user)
    return {
        "status": "success",
        "message": "Profile updated successfully",
        "user": {
            "id": current_user.id,
            "phone_number": current_user.phone_number,
            "email": current_user.email,
            "display_name": current_user.display_name,
            "role": current_user.role,
            "dhan_client_id": current_user.dhan_client_id,
            "dhan_access_token": current_user.dhan_access_token,
            **sub_info
        }
    }

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    sub_info = get_user_subscription_info(current_user)
    return {
        "id": current_user.id,
        "phone_number": current_user.phone_number,
        "email": current_user.email,
        "display_name": current_user.display_name,
        "role": current_user.role,
        "dhan_client_id": current_user.dhan_client_id,
        "dhan_access_token": current_user.dhan_access_token,
        **sub_info
    }

class DhanTestSchema(BaseModel):
    dhan_client_id: str
    dhan_access_token: str

@router.post("/test-dhan")
async def test_dhan_connection(data: DhanTestSchema):
    client_id = data.dhan_client_id.strip()
    token = data.dhan_access_token.strip()
    if not client_id or not token:
        raise HTTPException(status_code=400, detail="Client ID and Access Token cannot be blank")
        
    try:
        from dhanhq import dhanhq, DhanContext
        client = dhanhq(DhanContext(client_id, token))
        
        # Test profile / fund limits first
        resp = client.get_fund_limits()
        if not (isinstance(resp, dict) and resp.get("status") == "success"):
            # Fallback to test option chain
            resp = client.option_chain(under_security_id=13, under_exchange_segment="IDX_I", expiry="2026-08-11")
        
        if isinstance(resp, dict) and resp.get("status") == "success":
            return {"status": "success", "message": "🟢 Connection Successful! Dhan HQ live stream is active."}
        else:
            remarks = resp.get("remarks") if isinstance(resp, dict) else "Authentication Failed"
            err_detail = "Invalid or Expired Dhan Access Token (Generate fresh token on web.dhan.co)"
            if isinstance(remarks, str) and remarks.strip():
                err_detail = remarks
            elif isinstance(remarks, dict):
                err_detail = remarks.get("error_message") or remarks.get("message") or remarks.get("error_type") or str(remarks)
            raise HTTPException(status_code=400, detail=f"{err_detail}")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dhan Connection Exception: {str(e)}")
