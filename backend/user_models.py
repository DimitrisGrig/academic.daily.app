from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.sql import func
from database import Base


class User(Base):
    """
    User model for storing Clerk user information in the database.
    This is optional - Clerk manages users, but you can sync to your DB.
    """
    __tablename__ = "users"

    clerk_user_id = Column(String, primary_key=True, index=True)  # Clerk user ID
    email = Column(String, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    deleted_account = Column(Boolean, default=False)
    # Email digest subscription (True = subscribed, False = unsubscribed)
    email_digest_subscribed = Column(Boolean, default=True, nullable=False)
    # Unique token for one-click unsubscribe links (no login required)
    unsubscribe_token = Column(String, unique=True, index=True, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# Example: If you want to store additional user data
class UserProfile(Base):
    """
    Additional user profile information beyond what Clerk provides
    """
    __tablename__ = "user_profiles"

    clerk_user_id = Column(String, primary_key=True, index=True)
    preferences = Column(JSONB, default=None)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
