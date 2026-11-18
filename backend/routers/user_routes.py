from fastapi import APIRouter, Depends, HTTPException, Body, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from auth import get_current_user, verify_admin_user
from database import get_local_db
from user_models import User, UserProfile
from schemas import UserResponse
from typing import Optional, List
from pydantic import BaseModel
import requests
import os
from dotenv import load_dotenv

load_dotenv()


class UserSyncData(BaseModel):
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None


router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/search")
async def search_users(q: str = Query(..., min_length=1), current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Search users by email, first name, or last name.
    Returns up to 10 matching users (excluding the caller).
    """
    q = q.strip().lower()
    if not q:
        return []

    pattern = f"%{q}%"
    results = (
        db.query(User)
        .filter(
            User.clerk_user_id != current_user["user_id"],
            or_(
                func.lower(User.email).like(pattern),
                func.lower(User.first_name).like(pattern),
                func.lower(User.last_name).like(pattern),
            ),
        )
        .order_by(User.email)
        .limit(10)
        .all()
    )

    return [
        {
            "email": u.email,
            "first_name": u.first_name or "",
            "last_name": u.last_name or "",
            "display_name": f"{u.first_name or ''} {u.last_name or ''}".strip() or u.email,
        }
        for u in results
    ]


@router.post("/sync", response_model=UserResponse)
async def sync_user_to_database(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Sync the current Clerk user to the local database.
    Call this after a user first logs in to create their database record.
    """
    clerk_user_id = current_user["user_id"]
    
    # Try to get email from various possible fields in the token
    email = current_user.get("email") or current_user.get("primary_email_address") or current_user.get("email_addresses", [{}])[0].get("email_address")
    # If still no email, use a placeholder or fetch from Clerk API
    if not email:
        # For now, we'll use the user_id as a placeholder email
        email = f"{clerk_user_id}@clerk.user"
        print(f"Warning: No email found in token for user {clerk_user_id}, using placeholder")
    
    print(f"Syncing user - ID: {clerk_user_id}, Email: {email}")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    
    if existing_user:
        # Update email if changed and not a placeholder
        if existing_user.email != email and not email.endswith("@clerk.user"):
            existing_user.email = email
            db.commit()
            db.refresh(existing_user)
        print(f"User already exists: {existing_user.clerk_user_id}")
        return existing_user
    
    # Create new user
    new_user = User(
        clerk_user_id=clerk_user_id,
        email=email,
        # You can extract more fields from the JWT token if available
        # first_name=current_user.get("first_name"),
        # last_name=current_user.get("last_name"),
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"Created new user: {new_user.clerk_user_id}")
    return new_user


@router.post("/sync-with-data", response_model=UserResponse)
async def sync_user_with_data(user_data: UserSyncData, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Sync user with complete data from frontend.
    This is preferred as the frontend has access to full user object from Clerk.
    """
    clerk_user_id = current_user["user_id"]
    
    print(f"Syncing user with data - ID: {clerk_user_id}, Email: {user_data.email}")
    
    # Check if user already exists
    existing_user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    
    if existing_user:
        # Update user information
        existing_user.email = user_data.email
        if user_data.first_name:
            existing_user.first_name = user_data.first_name
        if user_data.last_name:
            existing_user.last_name = user_data.last_name
        db.commit()
        db.refresh(existing_user)
        print(f"Updated existing user: {existing_user.clerk_user_id}")
        return existing_user
    
    # Create new user
    new_user = User(
        clerk_user_id=clerk_user_id,
        email=user_data.email,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    print(f"Created new user with data: {new_user.clerk_user_id}")
    return new_user


@router.get("/me", response_model=UserResponse)
async def get_current_user_from_db(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get the current user's information from the database.
    """
    user = db.query(User).filter(
        User.clerk_user_id == current_user["user_id"]
    ).first()
    
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found in database. Please sync your account first."
        )
    
    return user



@router.get("/sync_clerk_with_database")
async def sync_clerk_with_database(db: Session = Depends(get_local_db), admin_user: dict = Depends(verify_admin_user)):
    """
    Sync all users from Clerk to the local database.
    This will:
    1. Fetch all users from Clerk
    2. Create or update users in the local database
    3. Mark deleted accounts in the database
    """
    CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
    
    if not CLERK_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Clerk secret key not configured")
    
    # Get Clerk API base URL (extract from secret key or use default)
    # For Clerk, the API base URL is typically api.clerk.com
    clerk_api_url = "https://api.clerk.com/v1"
    
    headers = {
        "Authorization": f"Bearer {CLERK_SECRET_KEY}",
        "Content-Type": "application/json"
    }
    
    try:
        # Fetch all users from Clerk
        all_clerk_users = []
        offset = 0
        limit = 100  # Clerk's default limit
        
        while True:
            response = requests.get(f"{clerk_api_url}/users", headers=headers, params={"limit": limit, "offset": offset})
            response.raise_for_status()
            
            users_batch = response.json()
            if not users_batch:
                break
                
            all_clerk_users.extend(users_batch)
            
            # If we got fewer users than the limit, we've reached the end
            if len(users_batch) < limit:
                break
                
            offset += limit
        
        print(f"Fetched {len(all_clerk_users)} users from Clerk")
        
        # Get all clerk_user_ids from Clerk
        clerk_user_ids = set()
        synced_users = []
        
        for clerk_user in all_clerk_users:
            user_id = clerk_user.get("id")
            if not user_id:
                continue
                
            clerk_user_ids.add(user_id)
            
            # Extract user information
            email_addresses = clerk_user.get("email_addresses", [])
            primary_email = None
            
            # Find primary email
            for email_obj in email_addresses:
                if email_obj.get("id") == clerk_user.get("primary_email_address_id"):
                    primary_email = email_obj.get("email_address")
                    break
            
            # Fallback to first email if primary not found
            if not primary_email and email_addresses:
                primary_email = email_addresses[0].get("email_address")
            
            # Skip if no email found
            if not primary_email:
                print(f"Warning: No email found for user {user_id}, skipping")
                continue
            
            first_name = clerk_user.get("first_name")
            last_name = clerk_user.get("last_name")
            
            # Check if user exists in database by clerk_user_id
            existing_user = db.query(User).filter(User.clerk_user_id == user_id).first()
            
            if existing_user:
                # Update existing user
                existing_user.email = primary_email
                existing_user.first_name = first_name
                existing_user.last_name = last_name
                existing_user.is_active = True
                existing_user.deleted_account = False  # User exists in Clerk, so not deleted
                synced_users.append({"action": "updated", "user_id": user_id, "email": primary_email})
            else:
                # Check if email already exists with a different clerk_user_id
                existing_email_user = db.query(User).filter(User.email == primary_email).first()
                
                if existing_email_user:
                    # Email exists but with different clerk_user_id
                    # This could mean the user was recreated in Clerk or there's a data inconsistency
                    # Update the existing record with the new clerk_user_id
                    print(f"Warning: Email {primary_email} exists with different clerk_user_id. "
                          f"Updating from {existing_email_user.clerk_user_id} to {user_id}")
                    existing_email_user.clerk_user_id = user_id
                    existing_email_user.first_name = first_name
                    existing_email_user.last_name = last_name
                    existing_email_user.is_active = True
                    existing_email_user.deleted_account = False
                    synced_users.append({
                        "action": "updated_clerk_id", 
                        "user_id": user_id, 
                        "email": primary_email,
                        "note": f"Updated clerk_user_id from {existing_email_user.clerk_user_id}"
                    })
                else:
                    # Create new user
                    new_user = User(
                        clerk_user_id=user_id,
                        email=primary_email,
                        first_name=first_name,
                        last_name=last_name,
                        is_active=True,
                        deleted_account=False
                    )
                    db.add(new_user)
                    synced_users.append({"action": "created", "user_id": user_id, "email": primary_email})
        
        # Mark users as deleted if they exist in DB but not in Clerk
        db_users = db.query(User).all()
        deleted_count = 0
        
        for db_user in db_users:
            if db_user.clerk_user_id not in clerk_user_ids:
                # User exists in DB but not in Clerk - mark as deleted
                db_user.deleted_account = True
                db_user.is_active = False
                deleted_count += 1
                synced_users.append({
                    "action": "marked_deleted",
                    "user_id": db_user.clerk_user_id,
                    "email": db_user.email
                })
        
        # Commit all changes
        db.commit()
        
        return {
            "success": True,
            "total_clerk_users": len(all_clerk_users),
            "synced_users": len([u for u in synced_users if u["action"] in ["created", "updated"]]),
            "created": len([u for u in synced_users if u["action"] == "created"]),
            "updated": len([u for u in synced_users if u["action"] == "updated"]),
            "marked_deleted": deleted_count,
            "details": synced_users
        }
        
    except requests.exceptions.RequestException as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error communicating with Clerk API: {str(e)}")
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error syncing users: {str(e)}")

