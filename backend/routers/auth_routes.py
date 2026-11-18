from fastapi import APIRouter, Depends
from auth import get_current_user, get_optional_user
from typing import Optional

router = APIRouter(prefix="/api", tags=["api"])


@router.get("/user/profile")
async def get_user_profile(current_user: dict = Depends(get_current_user)):
    """
    Get current user's profile information
    """
    return {
        "user_id": current_user["user_id"],
        "email": current_user["email"],
        "session_id": current_user["session_id"]
    }


@router.get("/optional-auth")
async def optional_auth_route(user: Optional[dict] = Depends(get_optional_user)):
    """
    Optional authentication - shows different content based on auth status
    """
    if user:
        return {
            "message": "Welcome back!",
            "authenticated": True,
            "user_id": user["user_id"]
        }
    else:
        return {
            "message": "Hello, guest!",
            "authenticated": False
        }
