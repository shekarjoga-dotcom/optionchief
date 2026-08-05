from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from typing import List, Optional
from pydantic import BaseModel

from app.db.session import get_db
from app.db.models import User, Portfolio, AlertRule, RSIScannerLog
from app.routes.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

def check_super_admin(user: User):
    if user.role.lower() != "owner":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: Owner privileges required."
        )

class AdminUserResponse(BaseModel):
    id: int
    phone_number: str
    role: str
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
        response.append(AdminUserResponse(
            id=u.id,
            phone_number=u.phone_number,
            role=u.role,
            is_auto_scanning=u.is_auto_scanning,
            created_at=u.created_at.strftime("%Y-%m-%d %H:%M:%S") if u.created_at else "",
            dhan_client_id=u.dhan_client_id,
            has_dhan_token=bool(u.dhan_access_token)
        ))
    return response

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

@router.get("/system-stats")
async def get_system_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    check_super_admin(current_user)
    
    user_count = (await db.execute(select(func.count(User.id)))).scalar() or 0
    portfolio_count = (await db.execute(select(func.count(Portfolio.id)))).scalar() or 0
    rule_count = (await db.execute(select(func.count(AlertRule.id)))).scalar() or 0
    rsi_log_count = (await db.execute(select(func.count(RSIScannerLog.id)))).scalar() or 0
    
    return {
        "total_users": user_count,
        "total_portfolios": portfolio_count,
        "active_alert_rules": rule_count,
        "rsi_scanner_logs": rsi_log_count
    }
