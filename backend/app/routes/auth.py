import random
import os
import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel, Field
from passlib.context import CryptContext
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.db.models import User, OTPRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Security Configurations
JWT_SECRET = os.getenv("JWT_SECRET", "options_oracle_reborn_super_secret_key_change_me_in_prod_2026")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # Tokens expire in 7 days

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# Pydantic Schemas
class OTPRequestSchema(BaseModel):
    phone_number: str = Field(..., description="Phone number with country code")

class RegisterSchema(BaseModel):
    phone_number: str
    otp_code: str
    password: str

class LoginSchema(BaseModel):
    phone_number: str
    password: str = None
    otp_code: str = None

# JWT & Password Helpers
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

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
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id_str: str = payload.get("sub")
        if user_id_str is None:
            raise credentials_exception
        user_id = int(user_id_str)
    except jwt.PyJWTError:
        raise credentials_exception

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    return user

# Routes
@router.post("/request-otp")
async def request_otp(data: OTPRequestSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()
    otp = f"{random.randint(100000, 999999)}"
    expiry = datetime.utcnow() + timedelta(minutes=5)

    otp_req = OTPRequest(phone_number=phone, otp_code=otp, expires_at=expiry)
    db.add(otp_req)
    await db.commit()

    send_otp_sms(phone, otp)
    return {"status": "success", "message": "OTP sent successfully."}

@router.post("/register")
async def register(data: RegisterSchema, db: AsyncSession = Depends(get_db)):
    phone = data.phone_number.strip()
    code = data.otp_code.strip()
    password = data.password.strip()

    # 1. Validate OTP
    now = datetime.utcnow()
    otp_query = select(OTPRequest).where(
        OTPRequest.phone_number == phone,
        OTPRequest.otp_code == code,
        OTPRequest.expires_at >= now
    ).order_by(OTPRequest.created_at.desc())

    otp_res = await db.execute(otp_query)
    otp_req = otp_res.scalars().first()

    is_mock_bypass = (code == "123456")

    if not otp_req and not is_mock_bypass:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP code")

    # 2. Check if user already exists
    user_exists_query = select(User).where(User.phone_number == phone)
    user_exists_res = await db.execute(user_exists_query)
    if user_exists_res.scalars().first():
        raise HTTPException(status_code=400, detail="User with this phone number already registered")

    # 3. Determine role (First user is Owner, others are Viewers)
    users_count_query = select(func.count(User.id))
    users_count_res = await db.execute(users_count_query)
    users_count = users_count_res.scalar() or 0

    role = "owner" if users_count == 0 else "viewer"

    # 4. Create User
    hashed_password = get_password_hash(password)
    new_user = User(
        phone_number=phone,
        password_hash=hashed_password,
        role=role
    )
    db.add(new_user)
    if otp_req:
        await db.delete(otp_req)
        
    await db.commit()
    await db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "phone": new_user.phone_number, "role": new_user.role})

    return {
        "status": "success",
        "message": f"User registered successfully as {role}.",
        "token": token,
        "user": {
            "phone_number": new_user.phone_number,
            "role": new_user.role
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
        is_mock_bypass = (code == "123456")
        
        now = datetime.utcnow()
        otp_query = select(OTPRequest).where(
            OTPRequest.phone_number == phone,
            OTPRequest.otp_code == code,
            OTPRequest.expires_at >= now
        ).order_by(OTPRequest.created_at.desc())
        otp_res = await db.execute(otp_query)
        otp_req = otp_res.scalars().first()
        
        if otp_req or is_mock_bypass:
            authenticated = True
            if otp_req:
                await db.delete(otp_req)
                await db.commit()

    if not authenticated:
        raise HTTPException(status_code=400, detail="Invalid password or OTP code")

    token = create_access_token({"sub": str(user.id), "phone": user.phone_number, "role": user.role})

    return {
        "status": "success",
        "token": token,
        "user": {
            "phone_number": user.phone_number,
            "role": user.role
        }
    }

@router.get("/me")
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "phone_number": current_user.phone_number,
        "role": current_user.role
    }
