"""
Middleware for logging all API route requests to the database.
This automatically logs every request without needing manual calls in each route.
"""
from fastapi import Request, BackgroundTasks
from starlette.middleware.base import BaseHTTPMiddleware
from sqlalchemy.orm import Session
import models
from database import get_local_db
from auth import verify_token
import time
import json


class RouteLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that logs all API requests to the log_routes table.
    
    - Automatically extracts user information from JWT token if present
    - Logs route path and query parameters
    - Uses background tasks to avoid blocking requests
    """
    
    async def dispatch(self, request: Request, call_next):
        # Skip logging for root/health check endpoints and high-frequency endpoints
        exclude_routes = [  
                            "/",
                            "/docs",
                            "/openapi.json",
                            "/redoc",
                            "/bookmarks/get_folders",
                            "/bookmarks/get_user_bookmarks",
                            "/mainFeed/is_onboarded",
                            "/customFeeds/get_custom_feeds",
                            "/notifications/unread-count",
                            "/tags/categorized",
                            "/tags/trending",
                            "/tags/popular",
                            "/tags/most-upvoted",
                            "/onboarding/tags/suggestions",  # High-frequency, skip logging
                            "/onboarding/tags/search",       # High-frequency, skip logging
                        ]
        
        if request.url.path in exclude_routes:
            return await call_next(request)
        
        # Extract logging info BEFORE processing (lightweight operations only)
        username = "anonymous"
        try:
            auth_header = request.headers.get("Authorization")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.replace("Bearer ", "")
                try:
                    payload = verify_token(token)
                    if payload:
                        username = payload.get("email") or payload.get("sub") or "unknown"
                except:
                    pass
        except:
            pass
        
        query_params = str(request.query_params) if request.query_params else None
        route_path = request.url.path
        
        # Process the request first
        response = await call_next(request)
        
        # Log AFTER request is processed, in a non-blocking way
        # This happens after the response is sent to the client
        try:
            # Use a separate DB session that doesn't block
            self._log_in_background(username, route_path, query_params)
        except:
            pass  # Silently fail - logging should never break requests
        
        return response
    
    def _log_in_background(self, username: str, route: str, params: str):
        """Log request in a separate DB transaction"""
        db = None
        try:
            db = next(get_local_db())
            log_entry = models.LogRoutes(
                username=username,
                requested_route=route,
                requested_params=params,
                requested_params_data=None
            )
            db.add(log_entry)
            db.commit()
        except:
            if db:
                try:
                    db.rollback()
                except:
                    pass
        finally:
            if db:
                try:
                    db.close()
                except:
                    pass
