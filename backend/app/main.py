import sys
sys.dont_write_bytecode = True

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app.routes import market, analytics, portfolio, auth, notifications, backtest, alerts, trade, rsi_scanner, admin
from app.db.session import engine, Base

# Trigger fresh deployment for Render multi-tenant auth
app = FastAPI(
    title="optionchief.in API",
    description="Quantitative Option Strategy Analysis and Portfolio Management Backend Engine",
    version="1.0.0"
)

# Enable CORS for the frontend development server
import os
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "*")
origins = [origin.strip() for origin in allowed_origins_env.split(",") if origin.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from fastapi import Request
from fastapi.responses import JSONResponse
import traceback

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb = traceback.format_exception(type(exc), exc, exc.__traceback__)
    return JSONResponse(
        status_code=500,
        content={
            "detail": "Internal Server Error",
            "error_type": type(exc).__name__,
            "error_message": str(exc),
            "traceback": "".join(tb)
        }
    )

@app.on_event("startup")
async def on_startup():
    import asyncio
    
    async def init_background_tasks():
        try:
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                
            from sqlalchemy import text, update
            from app.db.models import User
            async with engine.begin() as conn:
                try:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN dhan_client_id VARCHAR"))
                except Exception:
                    pass
                try:
                    await conn.execute(text("ALTER TABLE users ADD COLUMN dhan_access_token VARCHAR"))
                except Exception:
                    pass
                try:
                    await conn.execute(update(User).values(role="owner"))
                except Exception:
                    pass
        except Exception as e:
            print(f"[Startup DB Init Warning] {e}")

        try:
            from app.services.alert_scanner import active_alerts_scanner_loop
            asyncio.create_task(active_alerts_scanner_loop())
        except Exception as e:
            print(f"[Alert Scanner Task Warning] {e}")

        try:
            from app.services.telegram_bot import start_telegram_bot
            asyncio.create_task(start_telegram_bot())
        except Exception as e:
            print(f"[Telegram Bot Task Warning] {e}")

        try:
            from app.services.rsi_scanner import rsi_scanner_loop
            asyncio.create_task(rsi_scanner_loop())
        except Exception as e:
            print(f"[RSI Scanner Task Warning] {e}")

    # Launch asynchronously so FastAPI finishes startup instantly and Uvicorn binds $PORT immediately
    asyncio.create_task(init_background_tasks())

from app.routes import market, analytics, portfolio, auth, notifications, backtest, alerts, trade, rsi_scanner, admin, strategy

# Register routers
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(analytics.router)
app.include_router(portfolio.router)
app.include_router(notifications.router)
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtester"])
app.include_router(alerts.router)
app.include_router(trade.router)
app.include_router(rsi_scanner.router)
app.include_router(admin.router)
app.include_router(strategy.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "optionchief.in API",
        "description": "Calculations and option chain scraper server."
    }
