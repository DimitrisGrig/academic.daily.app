# 🔒 SECURITY FIXES - APPLY THESE IMMEDIATELY

## CRITICAL FIXES (Do Now):

### 1. Fix CORS - MOST IMPORTANT
In `backend/main.py`:

```python
# BEFORE (DANGEROUS):
allow_origins=["*"]

# AFTER (SECURE):
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",           # Local development
        "https://yourdomain.com",          # Production domain
        "https://www.yourdomain.com",      # Production with www
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # Specific methods only
    allow_headers=["Authorization", "Content-Type"],  # Specific headers only
    max_age=600,  # Cache preflight requests for 10 minutes
)
```

### 2. Remove Debug Logging
In `backend/auth.py`, REMOVE all print statements:

```python
# DELETE THESE LINES:
print(f"Clerk instance: {clerk_instance}")
print(f"JWKS URL: {JWKS_URL}")
print(f"Token header: {unverified_header}")
print(f"Available keys: {[k.get('kid') for k in jwks.get('keys', [])]}")
print(f"Token verified successfully for user: {payload.get('sub')}")
print(f"Full payload: {payload}")  # ESPECIALLY THIS - LEAKS USER DATA
print(f"JWT Error: {str(e)}")
print(f"Verification error: {str(e)}")
```

Use proper logging instead:
```python
import logging
logger = logging.getLogger(__name__)

# Only in development:
if os.getenv("ENV") == "development":
    logger.debug(f"Token verified for user: {payload.get('sub')}")
```

### 3. Add Token Expiration Verification
In `auth.py`:

```python
# BEFORE:
payload = jwt.decode(
    token,
    rsa_key,
    algorithms=["RS256"],
    options={"verify_aud": False}
)

# AFTER:
import time
payload = jwt.decode(
    token,
    rsa_key,
    algorithms=["RS256"],
    options={
        "verify_aud": False,
        "verify_exp": True,  # Verify token hasn't expired
    }
)

# Additional check:
if payload.get("exp") and payload["exp"] < time.time():
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token has expired"
    )
```

### 4. Add Environment Check
In `backend/.env`:

```env
ENV=production  # or development
```

In `main.py`:
```python
import os

ENV = os.getenv("ENV", "production")

# Only allow debug mode in development
if ENV == "production":
    app = FastAPI(docs_url=None, redoc_url=None)  # Disable API docs
else:
    app = FastAPI()
```

### 5. Verify .gitignore
Ensure `.gitignore` contains:

```
.env
.env.*
*.env
.env.local
.env.production
```

## MEDIUM PRIORITY FIXES:

### 6. Add Rate Limiting
Install:
```bash
pip install slowapi
```

In `main.py`:
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# On protected routes:
@router.get("/api/protected")
@limiter.limit("10/minute")
async def protected_route(request: Request, current_user = Depends(get_current_user)):
    ...
```

### 7. Add HTTPS Redirect (Production)
In `main.py`:

```python
from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

if ENV == "production":
    app.add_middleware(HTTPSRedirectMiddleware)
```

### 8. Improve JWKS Caching
In `auth.py`:

```python
from datetime import datetime, timedelta

# Add TTL cache
jwks_cache = {"data": None, "expires": None}

def get_jwks():
    """Fetch and cache JWKS from Clerk with TTL"""
    if jwks_cache["data"] and jwks_cache["expires"] > datetime.now():
        return jwks_cache["data"]
    
    if not JWKS_URL:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Clerk configuration is missing"
        )
    
    try:
        response = requests.get(JWKS_URL, timeout=5)
        response.raise_for_status()
        jwks = response.json()
        
        # Cache for 1 hour
        jwks_cache["data"] = jwks
        jwks_cache["expires"] = datetime.now() + timedelta(hours=1)
        
        return jwks
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch JWKS: {str(e)}"
        )
```

### 9. Add Request Timeout
In `auth.py`:

```python
response = requests.get(JWKS_URL, timeout=5)  # 5 second timeout
```

### 10. Add Security Headers
In `main.py`:

```python
from fastapi.middleware.trustedhost import TrustedHostMiddleware

app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["yourdomain.com", "www.yourdomain.com", "localhost"]
)

@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response
```

## CHECKLIST:

- [ ] Fix CORS to specific domains
- [ ] Remove all print() debug statements
- [ ] Add token expiration verification
- [ ] Add ENV variable (production/development)
- [ ] Verify .gitignore includes .env files
- [ ] Add rate limiting
- [ ] Add HTTPS redirect for production
- [ ] Improve JWKS caching with TTL
- [ ] Add request timeouts
- [ ] Add security headers
- [ ] Use HTTPS in production
- [ ] Rotate Clerk keys if exposed
- [ ] Review database connection security
- [ ] Add monitoring/alerting for failed auth attempts

## OVERALL SECURITY RATING:

**Current:** 5/10 ⚠️ (Functional but has critical vulnerabilities)
**After Fixes:** 9/10 ✓ (Production-ready with good security)

The authentication mechanism itself (Clerk + JWT) is solid, but the implementation has security gaps that must be fixed before production deployment.
