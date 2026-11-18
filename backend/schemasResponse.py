from pydantic import BaseModel, EmailStr
from typing import Any, Dict, List, Optional
from datetime import datetime


class MainFeedResponse(BaseModel):
    onBoard: bool
    
    
class MainFeedArticles(BaseModel):
    articles: List[Dict[str, Any]]