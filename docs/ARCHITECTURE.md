# 🏗️ Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER'S BROWSER                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              React Frontend (Port 5173)                  │  │
│  │                                                           │  │
│  │  ┌──────────────┐      ┌──────────────┐                │  │
│  │  │ ClerkProvider│      │   App.tsx    │                │  │
│  │  │   (Wrapper)  │────▶│  (Main App)  │                │  │
│  │  └──────────────┘      └──────────────┘                │  │
│  │         │                      │                        │  │
│  │         │                      ▼                        │  │
│  │         │              ┌──────────────┐                │  │
│  │         │              │  Components  │                │  │
│  │         │              │  - SignIn    │                │  │
│  │         │              │  - SignedIn  │                │  │
│  │         │              │  - UserButton│                │  │
│  │         │              └──────────────┘                │  │
│  │         │                                               │  │
│  │         ▼                                               │  │
│  │  ┌──────────────┐      ┌──────────────┐                │  │
│  │  │ Clerk Session│      │ Axios Instance│                │  │
│  │  │  (manages    │◀────│  + Interceptor │                │  │
│  │  │   tokens)    │      │  (lib/axios.ts)│                │  │
│  │  └──────────────┘      └──────────────┘                │  │
│  └─────────────────────────────│───────────────────────────┘  │
└────────────────────────────────│───────────────────────────────┘
                                 │ HTTP Requests
                                 │ + JWT Token in Header
                                 │ Authorization: Bearer <token>
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CLERK CLOUD SERVICE                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  OAuth Providers:  [Google] [Microsoft]                  │  │
│  │  Session Management & JWT Token Generation               │  │
│  │  JWKS Endpoint (Public Keys for Token Verification)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 │ JWT Verification
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                  FastAPI Backend (Port 8000)                    │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                     main.py (Entry Point)                 │  │
│  │  - CORS Middleware                                        │  │
│  │  - GZip Middleware                                        │  │
│  │  - Router Registration                                    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              auth.py (Authentication Middleware)          │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ 1. Extract JWT from Authorization header          │  │  │
│  │  │ 2. Fetch JWKS from Clerk                          │  │  │
│  │  │ 3. Verify JWT signature                           │  │  │
│  │  │ 4. Extract user info (user_id, email, session_id) │  │  │
│  │  │ 5. Return user data or raise 401 error            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Routers                            │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ auth_routes.py                                  │    │  │
│  │  │  - GET /api/protected (requires auth)           │    │  │
│  │  │  - GET /api/public (no auth)                    │    │  │
│  │  │  - GET /api/optional-auth (optional)            │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  │                                                           │  │
│  │  ┌─────────────────────────────────────────────────┐    │  │
│  │  │ user_routes.py                                  │    │  │
│  │  │  - POST /api/users/sync (sync user to DB)       │    │  │
│  │  │  - GET /api/users/me (get from DB)              │    │  │
│  │  │  - GET /api/users/profile (get profile)         │    │  │
│  │  │  - PUT /api/users/profile (update profile)      │    │  │
│  │  └─────────────────────────────────────────────────┘    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              database.py (Database Layer)                 │  │
│  │  - SQLAlchemy Engine                                      │  │
│  │  - Session Management                                     │  │
│  │  - Connection Pooling                                     │  │
│  └──────────────────────────────────────────────────────────┘  │
│                              │                                  │
│                              ▼                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                  ┌────────────────────────┐
                  │   PostgreSQL Database  │
                  │  - users table         │
                  │  - user_profiles table │
                  │  - other app tables    │
                  └────────────────────────┘
```

## Authentication Flow (Detailed)

```
┌─────────┐                                                    ┌─────────┐
│ Browser │                                                    │  Clerk  │
└────┬────┘                                                    └────┬────┘
     │                                                              │
     │ 1. User clicks "Sign In"                                    │
     ├──────────────────────────────────────────────────────────▶ │
     │                                                              │
     │ 2. Clerk OAuth Modal (Google/Microsoft)                     │
     │◀──────────────────────────────────────────────────────────┤
     │                                                              │
     │ 3. User authenticates with OAuth provider                   │
     ├──────────────────────────────────────────────────────────▶ │
     │                                                              │
     │ 4. Clerk creates session + JWT token                        │
     │◀──────────────────────────────────────────────────────────┤
     │                                                              │
     │ 5. Token stored in Clerk SDK                                │
     │                                                              │
     ▼                                                              │
┌─────────────┐                                                    │
│ Axios Call  │                                                    │
│ to Backend  │                                                    │
└──────┬──────┘                                                    │
       │                                                            │
       │ 6. Interceptor gets token from Clerk                      │
       ├────────────────────────────────────────────────────────▶ │
       │    window.Clerk.session.getToken()                        │
       │◀──────────────────────────────────────────────────────────┤
       │    Returns JWT                                            │
       │                                                            │
       │ 7. Adds Authorization: Bearer <JWT>                       │
       │                                                            │
       ▼                                                            │
┌──────────────┐                                                   │
│   FastAPI    │                                                   │
│   Backend    │                                                   │
└──────┬───────┘                                                   │
       │                                                            │
       │ 8. Extract JWT from header                                │
       │                                                            │
       │ 9. Fetch JWKS from Clerk                                  │
       ├────────────────────────────────────────────────────────▶ │
       │    GET /.well-known/jwks.json                             │
       │◀──────────────────────────────────────────────────────────┤
       │    Returns public keys                                    │
       │                                                            │
       │ 10. Verify JWT signature                                  │
       │     - Check signature matches                             │
       │     - Check token not expired                             │
       │     - Extract user_id, email, session_id                  │
       │                                                            │
       │ 11. Return user data to route handler                     │
       │                                                            │
       │ 12. Execute business logic                                │
       │                                                            │
       │ 13. Return response                                       │
       │◀──────────────────────────────────────────────────────────┤
       │                                                            │
       ▼                                                            │
   Response to Browser                                             │
```

## Data Flow for API Request

```
Frontend Request:
┌────────────────────────────────────────┐
│ axiosInstance.get('/api/protected')    │
└─────────────────┬──────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────┐
│ Axios Request Interceptor              │
│ - Gets token from Clerk SDK            │
│ - Adds to Authorization header         │
└─────────────────┬──────────────────────┘
                  │
                  ▼ HTTP Request
┌────────────────────────────────────────────────────┐
│ GET /api/protected                                 │
│ Headers:                                           │
│   Authorization: Bearer eyJhbGci...                │
│   Content-Type: application/json                   │
└─────────────────┬──────────────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────┐
│ FastAPI Backend                        │
│ ┌────────────────────────────────────┐ │
│ │ CORS Middleware                    │ │
│ │ ✓ Check origin                     │ │
│ └────────────────┬───────────────────┘ │
│                  ▼                      │
│ ┌────────────────────────────────────┐ │
│ │ Route Handler                      │ │
│ │ @router.get("/api/protected")      │ │
│ │ async def protected_route(         │ │
│ │   current_user = Depends(          │ │
│ │     get_current_user               │ │
│ │   )                                │ │
│ │ )                                  │ │
│ └────────────────┬───────────────────┘ │
│                  ▼                      │
│ ┌────────────────────────────────────┐ │
│ │ get_current_user (auth.py)         │ │
│ │ 1. Extract token from header       │ │
│ │ 2. Verify with Clerk JWKS          │ │
│ │ 3. Return user data                │ │
│ └────────────────┬───────────────────┘ │
│                  ▼                      │
│ ┌────────────────────────────────────┐ │
│ │ Business Logic                     │ │
│ │ - Access user_id, email            │ │
│ │ - Query database if needed         │ │
│ │ - Process request                  │ │
│ └────────────────┬───────────────────┘ │
└──────────────────┼─────────────────────┘
                   │
                   ▼ HTTP Response
┌────────────────────────────────────────┐
│ Response: 200 OK                       │
│ {                                      │
│   "message": "Success",                │
│   "user": { ... }                      │
│ }                                      │
└─────────────────┬──────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────┐
│ Axios Response Interceptor             │
│ - Handle errors (401, etc.)            │
│ - Retry with refreshed token if needed │
└─────────────────┬──────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────┐
│ Frontend Component                     │
│ - Receives response data               │
│ - Updates UI                           │
└────────────────────────────────────────┘
```

## Token Refresh Flow

```
API Request → 401 Unauthorized
              │
              ▼
┌─────────────────────────────────────────┐
│ Axios Response Interceptor              │
│ - Detects 401 error                     │
│ - Checks if retry attempted             │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Get Fresh Token from Clerk              │
│ window.Clerk.session.getToken({         │
│   skipCache: true                       │
│ })                                      │
└─────────────────┬───────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│ Retry Original Request                  │
│ - Update Authorization header           │
│ - Send request again                    │
└─────────────────┬───────────────────────┘
                  │
                  ├─ Success → Return Response
                  │
                  └─ Still Fails → Return Error
```

## Database Schema

```
┌─────────────────────────────────────┐
│          users table                │
├─────────────────────────────────────┤
│ clerk_user_id (PK)   VARCHAR        │
│ email                VARCHAR UNIQUE │
│ first_name           VARCHAR        │
│ last_name            VARCHAR        │
│ is_active            BOOLEAN        │
│ created_at           TIMESTAMP      │
│ updated_at           TIMESTAMP      │
└─────────────────────────────────────┘
              │
              │ 1:1
              ▼
┌─────────────────────────────────────┐
│      user_profiles table            │
├─────────────────────────────────────┤
│ clerk_user_id (PK, FK) VARCHAR      │
│ bio                    TEXT         │
│ avatar_url             VARCHAR      │
│ preferences            TEXT (JSON)  │
│ created_at             TIMESTAMP    │
│ updated_at             TIMESTAMP    │
└─────────────────────────────────────┘
```

## File Dependencies

```
Frontend:
main.tsx
  ├─ ClerkProvider (from @clerk/clerk-react)
  └─ App.tsx
       ├─ SignIn, SignedIn, SignedOut (from @clerk/clerk-react)
       ├─ useUser (from @clerk/clerk-react)
       └─ axiosInstance (from ./lib/axios.ts)
            └─ Uses window.Clerk to get tokens

Backend:
main.py
  ├─ routers/auth_routes.py
  │    └─ Depends(get_current_user)
  ├─ routers/user_routes.py
  │    └─ Depends(get_current_user)
  └─ auth.py
       ├─ verify_token()
       │    └─ Fetches JWKS from Clerk
       ├─ get_current_user()
       └─ get_optional_user()
```

## Key Components Explained

### 1. ClerkProvider (Frontend)
- Wraps entire React app
- Provides authentication context
- Manages user session
- Handles OAuth redirects

### 2. Axios Interceptor (Frontend)
- Automatically attaches JWT to requests
- Handles token refresh on 401 errors
- Manages retry logic

### 3. Auth Middleware (Backend)
- Extracts JWT from Authorization header
- Verifies token using Clerk's JWKS
- Provides user info to route handlers
- Raises 401 for invalid/missing tokens

### 4. Protected Routes (Backend)
- Use `Depends(get_current_user)`
- Automatically verified before handler runs
- Receive user info as parameter

---

This architecture provides:
✅ Secure authentication
✅ Automatic token management
✅ Seamless user experience
✅ Easy to extend and maintain
