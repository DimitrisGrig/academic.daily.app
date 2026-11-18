from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from auth import get_current_user, get_optional_user
import schemas, models, schemasResponse
from sqlalchemy.orm import Session
from database import get_local_db
from fnc import *
from datetime import timedelta, datetime

CURRENT_DATE = func.now() + timedelta(hours=get_GMT())


router = APIRouter(prefix="/user_actions", tags=["user_actions"])


@router.post("/upvote")
def upvote(data: schemas.UpvoteData, current_user: dict = Depends(get_current_user),  db: Session = Depends(get_local_db)):
    try:
        article = db.query(models.Articles).filter(models.Articles.id == data.article_id).first()
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Handle None case for upvotes
        if article.upvotes is None:
            article.upvotes = 0
        
        if data.undo:
            article.upvotes -= 1 if article.upvotes > 0 else 0
        else:
            article.upvotes += 1
        
        # Track user upvotes in UserUpvotes table
        user_upvote = db.query(models.UserUpvotes).filter(
            models.UserUpvotes.user_id == current_user['user_id'],
            models.UserUpvotes.article_id == data.article_id
        ).first()
        
        if data.undo:
            if user_upvote:
                db.delete(user_upvote)
        else:
            if not user_upvote:
                new_upvote = models.UserUpvotes(
                    user_id=current_user['user_id'],
                    article_id=data.article_id,
                    upvoted_at=CURRENT_DATE
                )
                db.add(new_upvote)
                
        db.commit()
        
        return {
            "success": True,
            "article_id": data.article_id,
            "upvotes": article.upvotes,
            "user_has_upvoted": not data.undo
        }

    except Exception as e:
        print(f"Error in upvote endpoint: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal Server Error")
    


@router.post("/article_click")
def article_click(data: schemas.ArticleClickData, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    try:
        # Count the click in articles table
        article = db.query(models.Articles).filter(models.Articles.id == data.article_id).first()
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        # Increment clicks, handle None case
        if article.clicks is None:
            article.clicks = 1
        else:
            article.clicks += 1
        
        
        # History - Log user click data
        is_clicked = db.query(models.UserArticleClicks).filter(
            models.UserArticleClicks.user_id == current_user['user_id'],
            models.UserArticleClicks.article_id == data.article_id
        ).first()
        
        if not is_clicked:
            # First time click by this user on this article
            new_click = models.UserArticleClicks(
                user_id=current_user['user_id'],
                article_id=data.article_id,
            )
            db.add(new_click)
        else:
            # Update the clicked_at timestamp for re-views
            is_clicked.clicked_at = datetime.utcnow()
        
        db.commit()
        db.refresh(article)
        
        return {
            "success": True,
            "message": "Article click tracked successfully",
            "article_id": data.article_id,
            "clicks": article.clicks
        }
        
    except Exception as e:
        print(f"Error in article_click endpoint: {e}")
        db.rollback()
        raise HTTPException(status_code=500, detail="Internal Server Error")