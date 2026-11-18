from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session
from database import get_local_db
from auth import get_current_user
from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
import models, schemas
from user_models import User
from fnc import *
from datetime import timedelta

CURRENT_DATE = func.now() + timedelta(hours=get_GMT())

router = APIRouter()

@router.post("/add_comment")
async def add_comment(comment_data: schemas.CommentCreate, db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Add a new comment to an article"""
    try:
        # Get user's first_name and last_name from User table
        user = db.query(User).filter(User.clerk_user_id == current_user["user_id"]).first()
        
        first_name = ""
        last_name = ""
        if user:
            first_name = user.first_name or ""
            last_name = user.last_name or ""
        
        # Create new comment
        new_comment = models.Comment(
            article_id=comment_data.article_id,
            user_id=current_user["user_id"],
            first_name=first_name,
            last_name=last_name,
            comment_text=comment_data.comment_text,
            created_at=CURRENT_DATE
        )
        
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
        
        # Get total comment count for this article
        comments_count = db.query(models.Comment).filter(
            models.Comment.article_id == comment_data.article_id
        ).count()
        
        return {
            "success": True,
            "comment": schemas.CommentResponse.from_orm(new_comment),
            "comments_count": comments_count
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add comment: {str(e)}")



@router.get("/get_comments/{article_id}")
async def get_comments(article_id: int, db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Get all comments for an article (newest first)"""
    try:
        comments = db.query(models.Comment).filter(
            models.Comment.article_id == article_id
        ).order_by(models.Comment.created_at.desc()).all()
        
        return {
            "comments": [schemas.CommentResponse.from_orm(comment) for comment in comments],
            "count": len(comments)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch comments: {str(e)}")



@router.delete("/delete_comment/{comment_id}")
async def delete_comment(comment_id: int, db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """Delete a comment (only by the comment author)"""
    try:
        comment = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
        
        if not comment:
            raise HTTPException(status_code=404, detail="Comment not found")
        
        # Check if user is the comment author
        if comment.user_id != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="You can only delete your own comments")
        
        article_id = comment.article_id
        db.delete(comment)
        db.commit()
        
        # Get updated comment count
        comments_count = db.query(models.Comment).filter(models.Comment.article_id == article_id).count()
        
        return {
            "success": True,
            "message": "Comment deleted successfully",
            "comments_count": comments_count
        }
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete comment: {str(e)}")
