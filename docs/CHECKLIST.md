# 🎯 Setup Checklist

Use this checklist to ensure everything is configured correctly.

## ☁️ Clerk Setup

- [ ] Create account at [clerk.com](https://clerk.com)
- [ ] Create new application in Clerk Dashboard
- [ ] Enable Google OAuth provider
- [ ] Enable Microsoft OAuth provider
- [ ] Copy Publishable Key (pk_test_...)
- [ ] Copy Secret Key (sk_test_...)
- [ ] Configure allowed redirect URLs (http://localhost:5173)

## 🔧 Backend Configuration

- [ ] Navigate to `backend/` directory
- [ ] Create `.env` file from `.env.example`
- [ ] Add `CLERK_PUBLISHABLE_KEY` to `.env`
- [ ] Add `CLERK_SECRET_KEY` to `.env`
- [ ] Configure database credentials in `.env`
- [ ] Install Python dependencies:
  ```bash
  pip install fastapi uvicorn sqlalchemy psycopg2-binary python-dotenv pyjwt[crypto] python-jose[cryptography] requests
  ```
- [ ] Verify all routers are imported in `main.py`

## ⚛️ Frontend Configuration

- [ ] Navigate to `frontend/` directory
- [ ] Create `.env` file from `.env.example`
- [ ] Add `VITE_CLERK_PUBLISHABLE_KEY` to `.env`
- [ ] Set `VITE_API_URL=http://localhost:8000` in `.env`
- [ ] Install npm dependencies:
  ```bash
  npm install
  ```
- [ ] Verify ClerkProvider is configured in `main.tsx`

## 🚀 Running the Application

- [ ] Start backend server:
  ```bash
  cd backend
  uvicorn main:app --reload --port 8000
  ```
- [ ] Verify backend is running at http://localhost:8000
- [ ] Check http://localhost:8000/docs for API documentation
- [ ] Start frontend development server:
  ```bash
  cd frontend
  npm run dev
  ```
- [ ] Verify frontend is running at http://localhost:5173

## ✅ Testing

- [ ] Open browser to http://localhost:5173
- [ ] Verify Clerk sign-in component appears
- [ ] Click sign-in and authenticate with Google or Microsoft
- [ ] Verify successful login and redirect
- [ ] Check that user information displays correctly
- [ ] Click "Test Protected API" button
- [ ] Verify successful API response
- [ ] Check browser console for any errors
- [ ] Open browser DevTools → Network tab
- [ ] Verify Authorization header is present in API requests
- [ ] Test logout functionality

## 🔍 Verification

- [ ] Check backend terminal for incoming API requests
- [ ] Verify JWT tokens are being validated (no auth errors)
- [ ] Test accessing protected route while logged out (should fail)
- [ ] Test accessing protected route while logged in (should succeed)
- [ ] Verify token refresh works (wait for token to expire if needed)

## 📊 Database (Optional)

If you want to sync users to your database:

- [ ] Database is running and accessible
- [ ] Database credentials in `.env` are correct
- [ ] Run migrations to create user tables:
  ```bash
  # Add user_models to your models imports
  # Then restart backend to create tables
  ```
- [ ] Test user sync endpoint: `/api/users/sync`
- [ ] Verify user appears in database after sync

## 🔐 Security Checklist

- [ ] `.env` files are in `.gitignore`
- [ ] Never commit API keys to version control
- [ ] HTTPS is enabled (required for production)
- [ ] CORS is properly configured for your domain
- [ ] Token expiration is configured appropriately
- [ ] Rate limiting is considered for production

## 📝 Common Issues

### Frontend won't start
- Check that `.env` file exists in frontend directory
- Verify `VITE_CLERK_PUBLISHABLE_KEY` is set
- Try deleting `node_modules` and running `npm install` again

### Backend authentication fails
- Verify both keys are from the same Clerk application
- Check that `CLERK_SECRET_KEY` is correct
- Ensure Clerk instance ID is extracted correctly in `auth.py`

### CORS errors
- Check that frontend URL is in `allow_origins` in `main.py`
- Verify backend is running on the correct port

### Token not being sent
- Check browser console for errors
- Verify user is signed in (Clerk session is active)
- Check that axios interceptor is configured correctly

## 🎉 Success Indicators

You've successfully set up the app when:

✅ User can sign in with Google or Microsoft  
✅ User information displays after login  
✅ Protected API calls succeed when authenticated  
✅ Protected API calls fail when not authenticated  
✅ Token is automatically attached to requests  
✅ No errors in browser console  
✅ No errors in backend terminal  

## 📚 Next Steps

Once everything is working:

1. Customize the UI in `App.tsx`
2. Add your own protected routes
3. Implement user profiles
4. Add role-based access control
5. Configure for production deployment

---

Need help? Check:
- README.md - Full documentation
- QUICKSTART.md - Quick setup guide
- EXAMPLES.md - Code examples
- Clerk docs - https://clerk.com/docs
