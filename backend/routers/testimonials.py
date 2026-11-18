from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_local_db
from auth import get_current_user
from models import Testimonial
from pydantic import BaseModel, Field
from typing import Optional

router = APIRouter()


class TestimonialCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5 stars")
    testimonial_text: str = Field(..., min_length=1, max_length=5000)


class TestimonialResponse(BaseModel):
    id: int
    rating: int
    testimonial_text: str
    created_at: str

    class Config:
        from_attributes = True


@router.post("/submit", response_model=dict)
def submit_testimonial(testimonial: TestimonialCreate, db: Session = Depends(get_local_db), current_user: dict = Depends(get_current_user)):
    """
    Submit a new testimonial with rating and text.
    """
    try:
        # Check if user already submitted a testimonial
        existing = db.query(Testimonial).filter(
            Testimonial.clerk_user_id == current_user["user_id"]
        ).first()

        if existing:
            # Update existing testimonial
            existing.rating = testimonial.rating
            existing.testimonial_text = testimonial.testimonial_text
            db.commit()
            db.refresh(existing)
            return {
                "message": "Testimonial updated successfully!",
                "testimonial_id": existing.id
            }
        else:
            # Create new testimonial
            new_testimonial = Testimonial(
                clerk_user_id=current_user["user_id"],
                rating=testimonial.rating,
                testimonial_text=testimonial.testimonial_text
            )
            db.add(new_testimonial)
            db.commit()
            db.refresh(new_testimonial)
            
            return {
                "message": "Testimonial submitted successfully!",
                "testimonial_id": new_testimonial.id
            }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error submitting testimonial: {str(e)}")


@router.get("/my-testimonial", response_model=Optional[TestimonialResponse])
def get_my_testimonial(db: Session = Depends(get_local_db),current_user: dict = Depends(get_current_user)):
    """
    Get the current user's testimonial if it exists.
    """
    try:
        testimonial = db.query(Testimonial).filter(
            Testimonial.clerk_user_id == current_user["user_id"]
        ).first()

        if not testimonial:
            return {"rating": None, "testimonial_text": None}

        return {
            "id": testimonial.id,
            "rating": testimonial.rating,
            "testimonial_text": testimonial.testimonial_text,
            "created_at": testimonial.created_at.isoformat()
        }
    except Exception as e:
        print(f"Error fetching testimonial: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error fetching testimonial: {str(e)}")
