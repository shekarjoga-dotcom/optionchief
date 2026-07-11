from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional
from pydantic import BaseModel
from app.db.session import get_db
from datetime import datetime
from app.db.models import AlertRule, User, TriggeredAlert
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/alerts", tags=["alerts"])

class TriggeredAlertResponse(BaseModel):
    id: str
    symbol: str
    strategy_name: str
    expiry: str
    pop: float
    max_profit: str
    max_loss: str
    rr_ratio: float
    timestamp: str
    current_pnl: str
    spot_price: Optional[float]
    legs: List[dict]
    rule_id: Optional[str]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True

class AlertRuleCreate(BaseModel):
    id: str
    strategy_type: str
    symbol: str
    expiry: str
    min_pop: float
    min_rr: float
    min_loss: Optional[float] = None
    max_loss: float
    min_delta: Optional[float] = None
    max_delta: Optional[float] = None
    min_theta: Optional[float] = None
    max_gamma: Optional[float] = None
    active: bool = True
    auto_execute: bool = False
    take_profit: Optional[float] = 20.0
    stop_loss: Optional[float] = 0.0

class AlertRuleResponse(BaseModel):
    id: str
    strategy_type: str
    symbol: str
    expiry: str
    min_pop: float
    min_rr: float
    min_loss: Optional[float] = None
    max_loss: float
    min_delta: Optional[float] = None
    max_delta: Optional[float] = None
    min_theta: Optional[float] = None
    max_gamma: Optional[float] = None
    active: bool
    auto_execute: bool
    take_profit: Optional[float] = 20.0
    stop_loss: Optional[float] = 0.0

    class Config:
        from_attributes = True

@router.get("/rules", response_model=List[AlertRuleResponse])
async def list_rules(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AlertRule).where(AlertRule.user_id == current_user.id))
    return result.scalars().all()

@router.post("/rules", response_model=AlertRuleResponse)
async def create_rule(
    rule_data: AlertRuleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if rule exists
    existing = await db.get(AlertRule, rule_data.id)
    if existing:
        if existing.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to edit this rule")
        # Update existing
        existing.strategy_type = rule_data.strategy_type
        existing.symbol = rule_data.symbol
        existing.expiry = rule_data.expiry
        existing.min_pop = rule_data.min_pop
        existing.min_rr = rule_data.min_rr
        existing.min_loss = rule_data.min_loss
        existing.max_loss = rule_data.max_loss
        existing.min_delta = rule_data.min_delta
        existing.max_delta = rule_data.max_delta
        existing.min_theta = rule_data.min_theta
        existing.max_gamma = rule_data.max_gamma
        existing.active = rule_data.active
        existing.auto_execute = rule_data.auto_execute
        existing.take_profit = rule_data.take_profit
        existing.stop_loss = rule_data.stop_loss
        await db.commit()
        await db.refresh(existing)
        return existing
        
    # Create new
    new_rule = AlertRule(
        id=rule_data.id,
        user_id=current_user.id,
        strategy_type=rule_data.strategy_type,
        symbol=rule_data.symbol,
        expiry=rule_data.expiry,
        min_pop=rule_data.min_pop,
        min_rr=rule_data.min_rr,
        min_loss=rule_data.min_loss,
        max_loss=rule_data.max_loss,
        min_delta=rule_data.min_delta,
        max_delta=rule_data.max_delta,
        min_theta=rule_data.min_theta,
        max_gamma=rule_data.max_gamma,
        active=rule_data.active,
        auto_execute=rule_data.auto_execute,
        take_profit=rule_data.take_profit,
        stop_loss=rule_data.stop_loss
    )
    db.add(new_rule)
    await db.commit()
    await db.refresh(new_rule)
    return new_rule

@router.delete("/rules/all")
async def delete_all_rules(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import delete
    await db.execute(delete(AlertRule).where(AlertRule.user_id == current_user.id))
    await db.commit()
    return {"status": "success", "message": "All alert rules deleted"}

@router.delete("/rules/{rule_id}")
async def delete_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rule = await db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    if rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this rule")
        
    await db.delete(rule)
    await db.commit()
    return {"status": "success", "message": "Alert rule deleted"}

@router.put("/rules/{rule_id}/toggle", response_model=AlertRuleResponse)
async def toggle_rule(
    rule_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    rule = await db.get(AlertRule, rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Alert rule not found")
    if rule.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to toggle this rule")
        
    rule.active = not rule.active
    await db.commit()
    await db.refresh(rule)
    return rule


@router.get("/triggered", response_model=List[TriggeredAlertResponse])
async def list_triggered_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(TriggeredAlert)
        .where(TriggeredAlert.user_id == current_user.id)
        .order_by(TriggeredAlert.created_at.desc())
    )
    return result.scalars().all()


@router.delete("/triggered/clear")
async def clear_all_triggered_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import delete
    await db.execute(
        delete(TriggeredAlert).where(TriggeredAlert.user_id == current_user.id)
    )
    await db.commit()
    return {"status": "success", "message": "All triggered alerts cleared"}


@router.delete("/triggered/{alert_id}")
async def delete_triggered_alert(
    alert_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    alert_obj = await db.get(TriggeredAlert, alert_id)
    if not alert_obj:
        raise HTTPException(status_code=404, detail="Triggered alert not found")
    if alert_obj.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to delete this alert")
    await db.delete(alert_obj)
    await db.commit()
    return {"status": "success", "message": "Triggered alert deleted"}


@router.put("/toggle-scanner")
async def toggle_scanner(
    active: bool,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    current_user.is_auto_scanning = active
    await db.commit()
    return {"status": "success", "is_auto_scanning": current_user.is_auto_scanning}
