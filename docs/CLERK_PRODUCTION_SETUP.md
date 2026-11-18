# Clerk Production Setup Guide

## Current Status
Your Clerk is currently in **TEST/DEVELOPMENT MODE** using test keys.

## Steps to Switch to Production

### 1. Configure Production Domain in Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your application
3. Navigate to **"Domains"** in the left sidebar
4. Add your production domain:
   - `app.daily-academic.com`
5. Remove or disable development domains if needed

### 2. Get Production API Keys

1. In Clerk Dashboard, go to **"API Keys"**
2. Copy your **Production Keys** (they start with `pk_live_` and `sk_live_`)
   - Production Publishable Key: `pk_live_...`
   - Production Secret Key: `sk_live_...`

### 3. Update Backend Environment Variables

Edit `/root/academic.daily.app/backend/.env`:

```bash
# Replace with your actual production keys from Clerk Dashboard
CLERK_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY_HERE
CLERK_SECRET_KEY=sk_live_YOUR_ACTUAL_KEY_HERE
```

Then restart the backend:
```bash
sudo systemctl restart academic-daily-backend
```

### 4. Update Frontend Environment Variables

Edit `/root/academic.daily.app/frontend/.env.production`:

```bash
# Replace with your actual production publishable key
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_ACTUAL_KEY_HERE
```

### 5. Rebuild and Redeploy Frontend

```bash
cd /root/academic.daily.app/frontend
npm run build
```

No need to restart Nginx - it serves the static files directly.

### 6. Configure Clerk Application Settings

In the Clerk Dashboard:

#### a. Update Allowed Origins
Go to **Settings → CORS** and add:
- `https://app.daily-academic.com`

#### b. Configure Sign-in/Sign-up URLs
Go to **Paths** and set:
- **Sign-in URL**: `https://app.daily-academic.com/sign-in`
- **Sign-up URL**: `https://app.daily-academic.com/sign-up`
- **Home URL**: `https://app.daily-academic.com`
- **After sign-in URL**: `https://app.daily-academic.com/MainFeed`
- **After sign-up URL**: `https://app.daily-academic.com/onboarding` (or wherever you want)

#### c. Session Settings
Go to **Sessions** and configure:
- **Session lifetime**: Set according to your needs (default: 7 days)
- **Inactivity timeout**: Set according to your needs

### 7. Test Your Production Setup

1. Clear your browser cache and cookies
2. Navigate to `https://app.daily-academic.com`
3. Try to sign in/sign up
4. Verify authentication works correctly

### 8. Migration Considerations

**IMPORTANT**: Test and development users **will NOT** automatically transfer to production!

If you need to migrate users:
1. Export users from test instance (Clerk Dashboard → Users → Export)
2. Import to production instance (requires Clerk support or manual process)

**Alternatively**: 
- Keep test keys for development environment
- Use production keys only on production server
- Users will need to create new accounts in production

### 9. Environment-Specific Configuration

For development (local machine), use `.env.development`:
```bash
VITE_API_URL=http://localhost:8000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_TEST_KEY
```

For production (server), use `.env.production`:
```bash
VITE_API_URL=/api
VITE_CLERK_PUBLISHABLE_KEY=pk_live_YOUR_PRODUCTION_KEY
```

## Quick Deployment Script

After updating the keys, run:

```bash
# Update backend
sudo systemctl restart academic-daily-backend

# Rebuild frontend
cd /root/academic.daily.app/frontend
npm run build

# Verify everything is running
sudo systemctl status nginx academic-daily-backend
```

## Verify Production Keys Are Active

Check if production keys are being used:

```bash
# Backend - check environment
grep CLERK_PUBLISHABLE_KEY /root/academic.daily.app/backend/.env

# Frontend - check built files (should see pk_live_ in the JavaScript)
grep -r "pk_live" /root/academic.daily.app/frontend/dist/
```

## Security Checklist

- ✅ Never commit production keys to git
- ✅ Use `.env` files (already in `.gitignore`)
- ✅ Production secret key (`sk_live_`) should ONLY be on backend
- ✅ Only publishable key (`pk_live_`) should be in frontend
- ✅ Set proper CORS origins in Clerk Dashboard
- ✅ Configure proper redirect URLs in Clerk Dashboard

## Troubleshooting

### Issue: "Invalid publishable key"
- Make sure you're using `pk_live_` not `pk_test_`
- Verify the key is copied correctly (no extra spaces)
- Check Clerk Dashboard that production keys are active

### Issue: CORS errors
- Add your domains to Clerk Dashboard → Settings → CORS
- Make sure you're using HTTPS (not HTTP) for production

### Issue: Users can't sign in
- Verify domains are configured in Clerk Dashboard
- Check that sign-in URL matches your app's route
- Clear browser cookies and try again

## Support

If you encounter issues:
1. Check Clerk Dashboard → Logs for detailed error messages
2. Check backend logs: `journalctl -u academic-daily-backend -f`
3. Check browser console for frontend errors
4. Contact Clerk Support at https://clerk.com/support
