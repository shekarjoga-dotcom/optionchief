from fastapi import APIRouter, HTTPException, Body, Depends, status
import os
import json
import uuid
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import flag_modified

from app.db.session import get_db
from app.db.models import User, Portfolio
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

class OptionLeg(BaseModel):
    id: str
    strike: float
    optionType: str  # 'C', 'P', 'F' (Future)
    expiry: str
    action: str      # 'BUY', 'SELL'
    quantity: int
    entryPrice: float
    currentPrice: float
    iv: float
    status: Optional[str] = "ACTIVE" # ACTIVE or SQUARED_OFF
    realizedPnL: Optional[float] = 0.0

class SavedPortfolio(BaseModel):
    id: str
    name: str
    symbol: str
    description: Optional[str] = ""
    legs: List[OptionLeg]
    createdAt: Optional[str] = None
    marginDeployed: Optional[float] = 0.0
    realizedPnL: Optional[float] = 0.0
    entrySpot: Optional[float] = 0.0
    peakProfit: Optional[float] = 0.0
    maxDrawdown: Optional[float] = 0.0
    takeProfit: Optional[float] = 20.0
    stopLoss: Optional[float] = 0.0

class ExecuteTradeRequest(BaseModel):
    broker: str  # "dhan", "kotak", "paper"
    name: str
    symbol: str
    description: Optional[str] = ""
    legs: List[OptionLeg]

@router.get("/list", response_model=List[SavedPortfolio])
async def list_portfolios(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Portfolio).where(Portfolio.user_id == current_user.id)
    )
    return result.scalars().all()

@router.post("/save")
async def save_portfolio(
    portfolio: SavedPortfolio,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Viewers are not allowed to save or modify portfolios."
        )
        
    if portfolio.symbol.upper().endswith("1!"):
        portfolio.symbol = portfolio.symbol[:-2]
    
    # Check if exists to update, else insert
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio.id)
    )
    existing = result.scalar_one_or_none()
    
    portfolio_dict = portfolio.model_dump()
    
    if existing:
        if existing.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Forbidden: You do not own this portfolio."
            )
        # Update existing record fields
        for key, val in portfolio_dict.items():
            setattr(existing, key, val)
    else:
        # Insert new record
        db_portfolio = Portfolio(
            id=portfolio.id,
            user_id=current_user.id,
            **portfolio_dict
        )
        db.add(db_portfolio)
        
    await db.commit()
    return {"status": "success", "message": "Portfolio saved successfully"}

@router.delete("/delete/{portfolio_id}")
async def delete_portfolio(
    portfolio_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Viewers are not allowed to delete portfolios."
        )
        
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    db_portfolio = result.scalar_one_or_none()
    
    if not db_portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
        
    if db_portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this portfolio."
        )
        
    await db.delete(db_portfolio)
    await db.commit()
    return {"status": "success", "message": "Portfolio deleted successfully"}

@router.post("/square-off/{portfolio_id}")
async def square_off_portfolio(
    portfolio_id: str,
    realized_pnl: float = Body(..., embed=True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Viewers are not allowed to square off portfolios."
        )
        
    result = await db.execute(
        select(Portfolio).where(Portfolio.id == portfolio_id)
    )
    db_portfolio = result.scalar_one_or_none()
    
    if not db_portfolio:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Portfolio not found"
        )
        
    if db_portfolio.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: You do not own this portfolio."
        )
        
    db_portfolio.realizedPnL = realized_pnl
    db_portfolio.marginDeployed = 0.0
    
    # Mark all legs as SQUARED_OFF
    legs = db_portfolio.legs
    if isinstance(legs, list):
        for leg in legs:
            leg["status"] = "SQUARED_OFF"
            leg["realizedPnL"] = realized_pnl / len(legs) if legs else 0.0
        db_portfolio.legs = list(legs)
        flag_modified(db_portfolio, "legs")
        
    await db.commit()
    return {"status": "success", "message": "Position squared off successfully", "portfolio": db_portfolio}

@router.post("/execute")
async def execute_trade(
    req: ExecuteTradeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "viewer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Viewers are not allowed to execute trades."
        )
        
    if req.symbol.upper().endswith("1!"):
        req.symbol = req.symbol[:-2]
        
    portfolio_id = str(uuid.uuid4())
    order_responses = []
    
    from app.routes.market import market_service
    
    if req.broker == "dhan":
        if not market_service.is_dhan_enabled:
            # Simulated Dhan order placement
            for leg in req.legs:
                order_responses.append({
                    "leg_id": leg.id,
                    "strike": leg.strike,
                    "type": leg.optionType,
                    "action": leg.action,
                    "qty": leg.quantity,
                    "status": "SIMULATED",
                    "message": "Live Dhan credentials not active. Order simulated."
                })
        else:
            # Real Dhan order placement
            try:
                for leg in req.legs:
                    # Resolve Dhan security ID
                    sec_id = market_service.get_dhan_option_security_id(
                        req.symbol, leg.strike, leg.optionType, leg.expiry
                    )
                    if not sec_id:
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST, 
                            detail=f"Could not resolve Dhan Security ID for {req.symbol} {leg.strike} {leg.optionType} Exp: {leg.expiry}"
                        )
                    
                    # Segment determination
                    exch_seg = "NSE_FNO"
                    if req.symbol.upper() in ["GOLD", "GOLDM", "SILVER", "SILVERM", "CRUDEOIL", "CRUDEOILM", "NATURALGAS", "NATGASMINI"]:
                        exch_seg = "MCX_COMM"
                    elif req.symbol.upper() == "SENSEX":
                        exch_seg = "BSE_FNO"
                    
                    o_type = "LIMIT" if leg.entryPrice > 0 else "MARKET"
                    price = float(leg.entryPrice) if o_type == "LIMIT" else 0.0
                    
                    # Place live order
                    order_resp = market_service.dhan.place_order(
                        security_id=str(sec_id),
                        exchange_segment=exch_seg,
                        transaction_type=leg.action.upper(),
                        quantity=int(leg.quantity),
                        order_type=o_type,
                        product_type="MARGIN",
                        price=price
                    )
                    
                    order_responses.append({
                        "leg_id": leg.id,
                        "strike": leg.strike,
                        "type": leg.optionType,
                        "action": leg.action,
                        "qty": leg.quantity,
                        "sec_id": sec_id,
                        "status": "SUCCESS" if order_resp.get("status") == "success" else "FAILED",
                        "message": order_resp.get("remarks") or order_resp.get("message") or "Executed on Dhan",
                        "order_id": order_resp.get("data", {}).get("orderId") if order_resp.get("data") else None
                    })
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=f"Dhan F&O Order Execution failed: {str(e)}"
                )
                
    elif req.broker == "kotak":
        # Kotak Neo execution (simulated)
        for leg in req.legs:
            order_responses.append({
                "leg_id": leg.id,
                "strike": leg.strike,
                "type": leg.optionType,
                "action": leg.action,
                "qty": leg.quantity,
                "status": "SIMULATED",
                "message": f"Successfully routed to Kotak Neo. Placed simulated {leg.action} order."
            })
            
    # For all brokers, save position to SQLite
    prefix = "Live (Dhan):" if req.broker == "dhan" else "Live (Kotak):" if req.broker == "kotak" else "Paper:"
    portfolio_name = f"{prefix} {req.name}"
    
    # Format legs
    legs_dict = [l.model_dump() for l in req.legs]
    
    new_portfolio = Portfolio(
        id=portfolio_id,
        user_id=current_user.id,
        name=portfolio_name,
        symbol=req.symbol,
        description=req.description or f"Executed via {req.broker.upper()} trade panel",
        legs=legs_dict,
        createdAt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        marginDeployed=0.0,
        realizedPnL=0.0,
        entrySpot=0.0,
        peakProfit=0.0,
        maxDrawdown=0.0,
        takeProfit=20.0,
        stopLoss=0.0
    )
    
    db.add(new_portfolio)
    await db.commit()
    
    return {
        "status": "success",
        "portfolio_id": portfolio_id,
        "broker": req.broker,
        "orders": order_responses,
        "message": f"Strategy successfully executed on {req.broker.upper()}!"
    }

