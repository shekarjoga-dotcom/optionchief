from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

from app.routes import market, analytics, portfolio, auth, notifications, backtest, alerts, trade
from app.db.session import engine, Base

app = FastAPI(
    title="OptionsOracle Reborn API",
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
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    # Start server-side active alerts scanner background loop
    import asyncio
    from app.services.alert_scanner import active_alerts_scanner_loop
    asyncio.create_task(active_alerts_scanner_loop())

    # Start active Telegram Bot background loop
    from app.services.telegram_bot import start_telegram_bot
    asyncio.create_task(start_telegram_bot())

# Register routers
app.include_router(auth.router)
app.include_router(market.router)
app.include_router(analytics.router)
app.include_router(portfolio.router)
app.include_router(notifications.router)
app.include_router(backtest.router, prefix="/api/backtest", tags=["Backtester"])
app.include_router(alerts.router)
app.include_router(trade.router)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "OptionsOracle Reborn API",
        "description": "Calculations and option chain scraper server."
    }
