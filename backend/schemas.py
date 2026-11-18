from pydantic import BaseModel, EmailStr, field_validator
from typing import List, Optional
from datetime import datetime


# Clerk User Schemas
class UserBase(BaseModel):
    email: EmailStr
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class UserCreate(UserBase):
    clerk_user_id: str


class UserResponse(UserBase):
    clerk_user_id: str
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class CurrentUser(BaseModel):
    """Schema for current authenticated user from JWT token"""
    user_id: str
    email: Optional[str] = None
    session_id: Optional[str] = None


class CreateFeed(BaseModel):
    name: str
    icon: str
    tags: List[str] = []
    journals: List[str] = []
    include_all_journals: bool = True
    publishers: List[str] = []
    default_sorting: str = "recommended"  # recommended, date, upvotes, downvotes, comments, clicks
    time_range: str = "all_time"  # all_time, past_24_hours, past_week, past_month
    publication_types: List[str] = []
    graphical_abstract_only: bool = False
    open_access_only: bool = False
    feed_type: str = "custom_feed"  # custom_feed, journal_follow


class UpdateFeed(BaseModel):
    key: str
    name: Optional[str] = None
    icon: Optional[str] = None
    tags: Optional[List[str]] = None
    journals: Optional[List[str]] = None
    include_all_journals: Optional[bool] = None
    publishers: Optional[List[str]] = None
    default_sorting: Optional[str] = None
    time_range: Optional[str] = None
    publication_types: Optional[List[str]] = None
    graphical_abstract_only: Optional[bool] = None
    open_access_only: Optional[bool] = None
    feed_type: Optional[str] = None


class DeleteFeed(BaseModel):
    key: str


# Bookmark Folder Schemas
class CreateBookmarkFolder(BaseModel):
    name: str
    icon: str


class UpdateBookmarkFolder(BaseModel):
    key: str
    name: Optional[str] = None
    icon: Optional[str] = None


class DeleteBookmarkFolder(BaseModel):
    key: str


# Onboarding Schemas
class OnboardingRequest(BaseModel):
    tags: List[str]


class FeedPreferencesUpdate(BaseModel):
    upvote_based_recommendations: Optional[bool] = None


class ScholarProfileUpdate(BaseModel):
    google_scholar_url: Optional[str] = None


class UpvoteData(BaseModel):
    article_id: int
    undo: Optional[bool] = False
    
    
class SaveBookmark(BaseModel):
    article_id: int
    folder_name: str
    folder_key: str


class DeleteBookmark(BaseModel):
    article_id: int
    folder_key: str
    
    
class CommentCreate(BaseModel):
    article_id: int
    comment_text: str


class CommentResponse(BaseModel):
    id: int
    article_id: int
    user_id: str
    first_name: str
    last_name: str
    comment_text: str
    created_at: datetime

    class Config:
        from_attributes = True
        

class ArticleClickData(BaseModel):
    article_id: int


class BioArchiveUpvoteData(BaseModel):
    article_id: int
    undo: Optional[bool] = False


class BioArchiveClickData(BaseModel):
    article_id: int


class SuggestNewJournal(BaseModel):
    journal_name_or_issn: str


# Group Schemas
class CreateGroup(BaseModel):
    name: str
    icon: str = "👥"
    invite_emails: List[str] = []
    is_public: bool = False
    tags: List[str] = []

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: List[str]) -> List[str]:
        cleaned = [t.strip().lower() for t in v if t.strip()]
        if len(cleaned) > 10:
            raise ValueError("Maximum of 10 tags allowed")
        return cleaned


class UpdateGroup(BaseModel):
    key: str
    name: Optional[str] = None
    icon: Optional[str] = None
    is_public: Optional[bool] = None
    tags: Optional[List[str]] = None

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, v: Optional[List[str]]) -> Optional[List[str]]:
        if v is None:
            return v
        cleaned = [t.strip().lower() for t in v if t.strip()]
        if len(cleaned) > 10:
            raise ValueError("Maximum of 10 tags allowed")
        return cleaned


class DeleteGroup(BaseModel):
    key: str


class InviteGroupMembers(BaseModel):
    group_key: str
    emails: List[str]


class RemoveGroupMember(BaseModel):
    group_key: str
    user_id: str


class AcceptGroupInvite(BaseModel):
    group_key: str


class LeaveGroup(BaseModel):
    group_key: str


class ShareArticleToGroup(BaseModel):
    group_key: str
    article_id: int
    shared_by_name: str | None = None


class PromoteGroupMember(BaseModel):
    group_key: str
    user_id: str


class DemoteGroupMember(BaseModel):
    group_key: str
    user_id: str


class RemoveSharedArticle(BaseModel):
    group_key: str
    article_id: int


# Group Comment Schemas
class GroupCommentCreate(BaseModel):
    group_key: str
    comment_text: str


class GroupCommentUpdate(BaseModel):
    comment_id: int
    comment_text: str


class GroupCommentDelete(BaseModel):
    comment_id: int
    group_key: str


class GroupCommentResponse(BaseModel):
    id: int
    group_key: str
    user_id: str
    first_name: str
    last_name: str
    comment_text: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ToggleGroupNotifications(BaseModel):
    group_key: str
    muted: bool