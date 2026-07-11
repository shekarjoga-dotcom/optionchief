from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import List, Optional
from app.db.session import get_db
from app.routes.auth import get_current_user
from app.db.models import User
from app.routes.portfolio import execute_trade, ExecuteTradeRequest, OptionLeg
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/trade", tags=["trade"])

class TradeLegSchema(BaseModel):
    id: str
    strike: float
    optionType: str  # "C" or "P" or "F"
    expiry: str
    action: str  # "BUY" or "SELL"
    quantity: int
    entryPrice: float
    currentPrice: float
    iv: float

class StrategyExecuteSchema(BaseModel):
    symbol: str
    name: str
    description: Optional[str] = ""
    legs: List[TradeLegSchema]
    broker: str = "paper"  # "paper", "dhan", "kotak"

@router.post("/execute")
async def execute_strategy(
    data: StrategyExecuteSchema,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Map to existing execute_trade implementation in portfolio
    legs_converted = []
    for l in data.legs:
        legs_converted.append(OptionLeg(
            id=l.id,
            strike=l.strike,
            optionType=l.optionType,
            expiry=l.expiry,
            action=l.action,
            quantity=l.quantity,
            entryPrice=l.entryPrice,
            currentPrice=l.currentPrice,
            iv=l.iv
        ))
        
    req = ExecuteTradeRequest(
        broker=data.broker,
        name=data.name,
        symbol=data.symbol,
        description=data.description,
        legs=legs_converted
    )
    
    return await execute_trade(req, db, current_user)

@router.get("/config")
def get_execution_config(current_user: User = Depends(get_current_user)):
    from app.routes.market import market_service
    dhan_configured = market_service.is_dhan_enabled
    return {
        "dhan": {
            "is_configured": dhan_configured,
            "mode": "live" if dhan_configured else "sandbox_simulation"
        },
        "kotak": {
            "is_configured": False,
            "mode": "sandbox_simulation"
        },
        "paper": {
            "is_configured": True,
            "mode": "sandbox_simulation"
        }
    }
