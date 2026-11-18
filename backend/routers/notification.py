from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
from database import get_local_db
from sqlalchemy.orm import Session
from sqlalchemy import desc
import models
from pydantic import BaseModel
from typing import List, Optional, Any, Dict
from datetime import datetime


router = APIRouter(prefix="/notifications", tags=["notifications"])


class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    notification_type: Optional[str] = None
    notification_metadata: Optional[Dict[str, Any]] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class MarkAsReadRequest(BaseModel):
    notification_ids: List[int]


@router.get("/", response_model=List[NotificationResponse])
async def get_user_notifications(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user), unread_only: bool = False):
    """
    Get all notifications for the current user.
    Can filter to show only unread notifications.
    """
    user_id = user.get("user_id")
    
    query = db.query(models.Notifications).filter(
        models.Notifications.user_id == user_id
    )
    
    if unread_only:
        query = query.filter(models.Notifications.is_read == False)
    
    notifications = query.order_by(desc(models.Notifications.created_at)).all()
    
    return notifications


@router.get("/unread-count")
async def get_unread_count(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Get the count of unread notifications for the current user.
    """
    user_id = user.get("user_id")
    
    unread_count = db.query(models.Notifications).filter(
        models.Notifications.user_id == user_id,
        models.Notifications.is_read == False
    ).count()
    
    return {"unread_count": unread_count}


@router.post("/mark-as-read")
async def mark_notifications_as_read(request: MarkAsReadRequest, db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Mark one or more notifications as read.
    """
    user_id = user.get("user_id")
    
    # Update notifications
    updated_count = db.query(models.Notifications).filter(
        models.Notifications.id.in_(request.notification_ids),
        models.Notifications.user_id == user_id
    ).update(
        {"is_read": True},
        synchronize_session=False
    )
    
    db.commit()
    
    return {
        "message": f"Marked {updated_count} notification(s) as read",
        "updated_count": updated_count
    }


@router.post("/mark-all-as-read")
async def mark_all_as_read(db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Mark all notifications as read for the current user.
    """
    user_id = user.get("user_id")
    
    updated_count = db.query(models.Notifications).filter(
        models.Notifications.user_id == user_id,
        models.Notifications.is_read == False
    ).update(
        {"is_read": True},
        synchronize_session=False
    )
    
    db.commit()
    
    return {
        "message": f"Marked all {updated_count} notification(s) as read",
        "updated_count": updated_count
    }


@router.delete("/{notification_id}")
async def delete_notification(notification_id: int, db: Session = Depends(get_local_db), user: dict = Depends(get_current_user)):
    """
    Delete a specific notification.
    """
    user_id = user.get("user_id")
    
    notification = db.query(models.Notifications).filter(
        models.Notifications.id == notification_id,
        models.Notifications.user_id == user_id
    ).first()
    
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    db.delete(notification)
    db.commit()
    
    return {"message": "Notification deleted successfully"}


