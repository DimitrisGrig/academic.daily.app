# Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Get Clerk API Keys

1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Enable Google and Microsoft OAuth providers
4. Copy your API keys from the dashboard

### 2. Configure Environment Variables

**Frontend** (`frontend/.env`):
```env
VITE_CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
VITE_API_URL=http://localhost:8000
```

**Backend** (`backend/.env`):
```env
CLERK_PUBLISHABLE_KEY=pk_test_your_key_here
CLERK_SECRET_KEY=sk_test_your_key_here
```

### 3. Install Dependencies

**Backend**:
```bash
cd backend
pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv pyjwt[crypto] python-jose[cryptography] requests
```

**Frontend**:
```bash
cd frontend
npm install
```

### 4. Run the Application

**Terminal 1 - Backend**:
```bash
cd backend
uvicorn main:app --reload --port 8000
```

**Terminal 2 - Frontend**:
```bash
cd frontend
npm run dev
```

### 5. Test It Out

1. Open `http://localhost:5173` in your browser
2. Click "Sign In" and authenticate with Google or Microsoft
3. Once logged in, click "Test Protected API" to verify everything works!

## 📝 What You Get

✅ Complete authentication with Google & Microsoft  
✅ Automatic token management  
✅ Protected API routes  
✅ User session handling  
✅ Token refresh on expiry  
✅ TypeScript support  
✅ Reusable API hooks  

## 🔧 Next Steps

- Customize the UI in `frontend/src/App.tsx`
- Add more protected routes in `backend/routers/auth_routes.py`
- Use `Depends(get_current_user)` to protect any FastAPI endpoint
- Use the `useApi` hook for type-safe API calls

Need help? Check out the full README.md!
