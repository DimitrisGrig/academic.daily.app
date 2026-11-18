from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
import requests
from typing import Optional
import os
import base64
from dotenv import load_dotenv
from cachetools import TTLCache, cached

load_dotenv()

# Clerk configuration
CLERK_PUBLISHABLE_KEY = os.getenv("CLERK_PUBLISHABLE_KEY")
CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
ADMIN_CLERK_USER_ID = os.getenv("ADMIN_CLERK_USER_ID")

# Blocked users – comma-separated Clerk user IDs loaded from .env
_blocked_raw = os.getenv("BLOCKED_CLERK_USER_IDS", "")
BLOCKED_CLERK_USER_IDS: set[str] = {
    uid.strip() for uid in _blocked_raw.split(",") if uid.strip()
}

cache = TTLCache(maxsize=1, ttl=3600)

# Extract the instance domain from the publishable key
# The publishable key is base64 encoded and contains the domain
def get_clerk_instance():
    if not CLERK_PUBLISHABLE_KEY:
        return None
    try:
        # Remove the pk_test_ or pk_live_ prefix
        key_without_prefix = CLERK_PUBLISHABLE_KEY.replace('pk_test_', '').replace('pk_live_', '')
        # Add padding if needed for base64 decoding
        padding = 4 - len(key_without_prefix) % 4
        if padding != 4:
            key_without_prefix += '=' * padding
        # Decode base64
        decoded = base64.b64decode(key_without_prefix).decode('utf-8')
        # Remove the trailing $ if present
        return decoded.rstrip('$')
    except Exception as e:
        print(f"Error decoding Clerk key: {e}")
        return None

clerk_instance = get_clerk_instance()

# JWKS URL for Clerk
JWKS_URL = f"https://{clerk_instance}/.well-known/jwks.json" if clerk_instance else None

# Debug logging
# print(f"Clerk instance: {clerk_instance}")
# print(f"JWKS URL: {JWKS_URL}")

security = HTTPBearer()


@cached(cache)
def get_jwks():
    """Fetch and cache JWKS from Clerk"""
    if not JWKS_URL:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Clerk configuration is missing")
    
    try:
        response = requests.get(JWKS_URL)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f"Failed to fetch JWKS: {str(e)}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication service unavailable")


def verify_token(token: str) -> dict:
    """Verify Clerk JWT token"""
    try:
        # Get JWKS
        jwks = get_jwks()
        
        # Decode the token header to get the kid (key ID)
        unverified_header = jwt.get_unverified_header(token)
        # print(f"Token header: {unverified_header}")
        
        # Find the key in JWKS
        rsa_key = {}
        for key in jwks.get("keys", []):
            if key["kid"] == unverified_header["kid"]:
                rsa_key = {
                    "kty": key["kty"],
                    "kid": key["kid"],
                    "use": key["use"],
                    "n": key["n"],
                    "e": key["e"]
                }
                break
        
        if not rsa_key:
            print(f"Available keys: {[k.get('kid') for k in jwks.get('keys', [])]}")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unable to find appropriate key")
        
        # Verify and decode the token
        payload = jwt.decode(
            token,
            rsa_key,
            algorithms=["RS256"],
            options={
                "verify_aud": False, # Clerk doesn't use aud claim by default
                "verify_exp": True,  # ✓ Verify expiration
            }
            
        )
        
        # print(f"Token verified successfully for user: {payload.get('sub')}")
        # print(f"Full payload: {payload}")
        return payload
        
    except JWTError as e:
        print(f"JWT Error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except Exception as e:
        print(f"Verification error: {str(e)}")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token validation failed")


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """
    Dependency to get the current authenticated user from the JWT token.
    Use this in your route dependencies to protect endpoints.
    """
    token = credentials.credentials
    
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    
    # Verify the token and get the payload
    payload = verify_token(token)
    
    # DEBUG: Log the token for tracing (remove in production)
    # print(token)
    
    # Extract user information from the token
    user = {
        "user_id": payload.get("sub"),  # Clerk uses 'sub' for user ID
        "email": payload.get("email"),
        "session_id": payload.get("sid"),
        "full_payload": payload
    }

    # Block restricted users – return 503 so the app appears to be down
    if user["user_id"] in BLOCKED_CLERK_USER_IDS:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Service temporarily unavailable"
        )

    return user


async def get_optional_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(HTTPBearer(auto_error=False))) -> Optional[dict]:
    """
    Optional authentication - returns user if authenticated, None otherwise.
    Use this for endpoints that work both authenticated and unauthenticated.
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def verify_admin_user(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Dependency that only lets the admin (ADMIN_CLERK_USER_ID) through.
    """
    if not ADMIN_CLERK_USER_ID or current_user.get("user_id") != ADMIN_CLERK_USER_ID:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access denied.")
    return current_user
