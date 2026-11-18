# Complete Integration Examples

## Frontend Examples

### 1. Using the useApi Hook

```tsx
import { useApi } from './hooks/useApi'
import type { ProtectedResponse } from './types/api'

function MyComponent() {
  const { data, loading, error, get } = useApi<ProtectedResponse>()

  const fetchData = async () => {
    await get('/api/protected')
  }

  return (
    <div>
      <button onClick={fetchData} disabled={loading}>
        {loading ? 'Loading...' : 'Get Data'}
      </button>
      {error && <p>Error: {error}</p>}
      {data && <p>{data.message}</p>}
    </div>
  )
}
```

### 2. Direct Axios Calls

```tsx
import axiosInstance from './lib/axios'
import { useUser } from '@clerk/clerk-react'

function MyComponent() {
  const { user } = useUser()

  const syncUser = async () => {
    try {
      const response = await axiosInstance.post('/api/users/sync')
      console.log('User synced:', response.data)
    } catch (error) {
      console.error('Sync failed:', error)
    }
  }

  return (
    <button onClick={syncUser}>
      Sync My Account
    </button>
  )
}
```

### 3. Protected Component Pattern

```tsx
import { SignedIn, SignedOut, useUser } from '@clerk/clerk-react'

function Dashboard() {
  const { user } = useUser()

  return (
    <>
      <SignedIn>
        <h1>Welcome, {user?.firstName}!</h1>
        <ProtectedContent />
      </SignedIn>
      
      <SignedOut>
        <h1>Please sign in to access the dashboard</h1>
        <SignInButton />
      </SignedOut>
    </>
  )
}
```

### 4. Sync User on First Login

```tsx
import { useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import axiosInstance from './lib/axios'

function App() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    const syncUserToDatabase = async () => {
      if (isLoaded && user) {
        try {
          await axiosInstance.post('/api/users/sync')
          console.log('User synced to database')
        } catch (error) {
          console.error('Failed to sync user:', error)
        }
      }
    }

    syncUserToDatabase()
  }, [user, isLoaded])

  return <YourAppContent />
}
```

## Backend Examples

### 1. Protected Endpoint (Requires Auth)

```python
from fastapi import APIRouter, Depends
from ..auth import get_current_user

router = APIRouter()

@router.get("/api/my-data")
async def get_my_data(current_user: dict = Depends(get_current_user)):
    # current_user contains: user_id, email, session_id
    user_id = current_user["user_id"]
    
    # Your logic here
    return {
        "message": f"Data for user {user_id}",
        "user_email": current_user["email"]
    }
```

### 2. Optional Authentication

```python
from fastapi import APIRouter, Depends
from ..auth import get_optional_user
from typing import Optional

router = APIRouter()

@router.get("/api/content")
async def get_content(user: Optional[dict] = Depends(get_optional_user)):
    if user:
        # Return personalized content for authenticated users
        return {
            "content": "Premium content",
            "user_id": user["user_id"]
        }
    else:
        # Return basic content for guests
        return {
            "content": "Basic content",
            "message": "Sign in for premium features"
        }
```

### 3. Database Integration

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..auth import get_current_user
from ..database import get_local_db
from ..user_models import User

router = APIRouter()

@router.post("/api/items")
async def create_item(
    item_data: dict,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    # Get user from database
    user = db.query(User).filter(
        User.clerk_user_id == current_user["user_id"]
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create item associated with user
    # ... your logic here
    
    return {"message": "Item created", "user_id": user.clerk_user_id}
```

### 4. Custom Error Handling

```python
from fastapi import APIRouter, Depends, HTTPException, status
from ..auth import verify_token

router = APIRouter()

@router.get("/api/admin")
async def admin_route(current_user: dict = Depends(get_current_user)):
    # Check if user has admin role (you'd add this to your JWT or database)
    if not current_user.get("is_admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    return {"message": "Admin dashboard data"}
```

## Testing Examples

### Test Protected Endpoint with curl

```bash
# 1. Get your token from Clerk (in browser console):
# await window.Clerk.session.getToken()

# 2. Use the token:
curl -X GET "http://localhost:8000/api/protected" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Test with Python requests

```python
import requests

# Get token from your frontend or Clerk dashboard
token = "your_clerk_token_here"

headers = {
    "Authorization": f"Bearer {token}"
}

response = requests.get(
    "http://localhost:8000/api/protected",
    headers=headers
)

print(response.json())
```

## Common Patterns

### 1. User Registration Flow

**Frontend**:
```tsx
import { useEffect } from 'react'
import { useUser } from '@clerk/clerk-react'
import axiosInstance from './lib/axios'

function useUserSync() {
  const { user, isLoaded } = useUser()

  useEffect(() => {
    if (isLoaded && user) {
      axiosInstance.post('/api/users/sync')
        .catch(err => console.error('User sync failed:', err))
    }
  }, [user, isLoaded])
}
```

**Backend**:
```python
@router.post("/api/users/sync")
async def sync_user(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    user = User(
        clerk_user_id=current_user["user_id"],
        email=current_user["email"]
    )
    db.add(user)
    db.commit()
    return {"message": "User synced"}
```

### 2. Role-Based Access Control

**Add to your User model**:
```python
class User(Base):
    __tablename__ = "users"
    clerk_user_id = Column(String, primary_key=True)
    email = Column(String)
    role = Column(String, default="user")  # "user", "admin", "premium"
```

**Create role checker**:
```python
from fastapi import HTTPException, Depends

async def require_admin(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    user = db.query(User).filter(
        User.clerk_user_id == current_user["user_id"]
    ).first()
    
    if not user or user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

# Use it:
@router.get("/api/admin/users")
async def get_all_users(admin_user: User = Depends(require_admin)):
    # Only admins can access this
    pass
```

## Environment Setup Checklist

### Frontend (.env)
```env
✅ VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
✅ VITE_API_URL=http://localhost:8000
```

### Backend (.env)
```env
✅ CLERK_PUBLISHABLE_KEY=pk_test_...
✅ CLERK_SECRET_KEY=sk_test_...
✅ Database credentials configured
```

### Clerk Dashboard Settings
```
✅ Google OAuth enabled
✅ Microsoft OAuth enabled
✅ Application URL configured
✅ Redirect URLs configured
```

## Troubleshooting Common Issues

### Issue: "Missing Clerk Publishable Key"
**Solution**: Create `.env` file with `VITE_CLERK_PUBLISHABLE_KEY`

### Issue: "Invalid token" 
**Solution**: Ensure backend and frontend use keys from same Clerk app

### Issue: Token not being sent
**Solution**: Check that user is signed in and Clerk session is active

### Issue: CORS errors
**Solution**: Update `allow_origins` in FastAPI CORS middleware

### Issue: User not in database
**Solution**: Call `/api/users/sync` endpoint after login
