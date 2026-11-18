# Deployment Guide - Daily Academic App

## Overview

This guide explains how to deploy the Daily Academic App with:

- **Frontend**: React app served by Nginx on `app.daily-academic.com`
- **Backend**: FastAPI running on `localhost:8000` (not publicly accessible)
- **Nginx**: Acts as reverse proxy, routing `/api/*` requests to the backend

## Architecture

```
Internet → Nginx (Port 80/443)
            ├── / → React Frontend (static files from /root/academic.daily.app/frontend/dist)
            └── /api/* → FastAPI Backend (localhost:8000)
```

The backend is **only accessible via localhost**, ensuring it can only be reached through Nginx.

## Prerequisites

1. Domain configured (DNS pointing to your server):
   - `app.daily-academic.com` → Your server IP

2. Server requirements:
   - Ubuntu/Debian Linux
   - Node.js and npm installed
   - Python 3.8+ with venv
   - Root access

## Quick Deployment

### Option 1: Automated Deployment (Recommended)

Run the deployment script:

```bash
cd /root/academic.daily.app
chmod +x deploy.sh
sudo ./deploy.sh
```

This script will:

1. Install/update Nginx
2. Create necessary log directories
3. Install gunicorn in the backend virtual environment
4. Build the React frontend
5. Configure Nginx
6. Set up the backend as a systemd service
7. Start all services

### Option 2: Manual Deployment

If you prefer to do it step by step:

#### Step 1: Install Nginx

```bash
sudo apt update
sudo apt install -y nginx
```

#### Step 2: Create Log Directories

```bash
sudo mkdir -p /var/log/gunicorn
sudo mkdir -p /var/log/academic-daily-backend
sudo mkdir -p /var/www/certbot
```

#### Step 3: Install Backend Dependencies

```bash
cd /root/academic.daily.app/backend
source venv/bin/activate
pip install gunicorn uvicorn[standard]
deactivate
```

#### Step 4: Build Frontend

```bash
cd /root/academic.daily.app/frontend

# Install dependencies if needed
npm install

# Build for production
npm run build
```

This creates optimized static files in `frontend/dist/`.

#### Step 5: Configure Nginx

```bash
# Copy the Nginx configuration
sudo cp /root/academic.daily.app/nginx.conf /etc/nginx/sites-available/daily-academic

# Enable the site
sudo ln -sf /etc/nginx/sites-available/daily-academic /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### Step 6: Set Up Backend Service

```bash
# Copy systemd service file
sudo cp /root/academic.daily.app/academic-daily-backend.service /etc/systemd/system/

# Reload systemd
sudo systemctl daemon-reload

# Enable and start the service
sudo systemctl enable academic-daily-backend.service
sudo systemctl start academic-daily-backend.service
```

## Verify Deployment

### Check Backend Status

```bash
# Check if backend service is running
sudo systemctl status academic-daily-backend

# View backend logs
sudo journalctl -u academic-daily-backend -f

# Check if backend is listening on localhost:8000
curl http://127.0.0.1:8000
```

### Check Nginx Status

```bash
# Check Nginx status
sudo systemctl status nginx

# View Nginx access logs
sudo tail -f /var/log/nginx/daily-academic-access.log

# View Nginx error logs
sudo tail -f /var/log/nginx/daily-academic-error.log
```

### Test the Application

1. Open your browser and navigate to:
   - http://app.daily-academic.com

2. The React app should load and API calls to `/api/*` should work correctly.

## SSL/HTTPS Setup with Let's Encrypt

For production, you should enable HTTPS:

### Step 1: Install Certbot

```bash
sudo apt install certbot python3-certbot-nginx
```

### Step 2: Obtain SSL Certificate

```bash
sudo certbot --nginx -d app.daily-academic.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### Step 3: Enable HTTPS in Nginx Config

Edit `/etc/nginx/sites-available/daily-academic` and uncomment the HTTPS server block (lines starting with `# server {` for port 443).

### Step 4: Restart Nginx

```bash
sudo systemctl restart nginx
```

### Step 5: Set Up Auto-Renewal

Certbot automatically sets up a renewal timer. Check it with:

```bash
sudo systemctl status certbot.timer
```

## Useful Commands

### Backend Management

```bash
# Start backend
sudo systemctl start academic-daily-backend

# Stop backend
sudo systemctl stop academic-daily-backend

# Restart backend
sudo systemctl restart academic-daily-backend

# View logs
sudo journalctl -u academic-daily-backend -f

# View gunicorn logs
sudo tail -f /var/log/gunicorn/error.log
```

### Nginx Management

```bash
# Start Nginx
sudo systemctl start nginx

# Stop Nginx
sudo systemctl stop nginx

# Restart Nginx
sudo systemctl restart nginx

# Reload configuration (no downtime)
sudo systemctl reload nginx

# Test configuration
sudo nginx -t
```

### Rebuild Frontend

When you make changes to the frontend:

```bash
cd /root/academic.daily.app/frontend
npm run build
# No need to restart anything - Nginx serves static files
```

### Update Backend Code

When you make changes to the backend:

```bash
cd /root/academic.daily.app/backend
source venv/bin/activate
# Make your changes
deactivate

# Restart the service
sudo systemctl restart academic-daily-backend
```

## Configuration Files

### Key Files

1. **Nginx Config**: `/etc/nginx/sites-available/daily-academic`
   - Serves frontend static files
   - Proxies `/api/*` to `localhost:8000`

2. **Backend Service**: `/etc/systemd/system/academic-daily-backend.service`
   - Systemd service for FastAPI backend
   - Automatically starts on boot

3. **Gunicorn Config**: `/root/academic.daily.app/backend/gunicorn_config.py`
   - Binds backend to `127.0.0.1:8000` (localhost only)
   - Configures workers and timeouts

4. **Frontend Env**: `/root/academic.daily.app/frontend/.env.production`
   - Sets `VITE_API_URL=/api` for production builds

## Security Features

✅ **Backend Isolation**: FastAPI only listens on localhost (127.0.0.1), not accessible from the internet

✅ **CORS Protection**: Backend only accepts requests from your domain

✅ **Nginx Proxy**: All external requests go through Nginx, which adds security headers

✅ **HTTPS Ready**: Configuration includes commented HTTPS block for easy SSL setup

## Troubleshooting

### Backend Not Starting

```bash
# Check logs
sudo journalctl -u academic-daily-backend -n 50

# Check if port 8000 is already in use
sudo lsof -i :8000

# Test manually
cd /root/academic.daily.app/backend
source venv/bin/activate
python -m uvicorn main:app --host 127.0.0.1 --port 8000
```

### Frontend Not Loading

```bash
# Check if build exists
ls -la /root/academic.daily.app/frontend/dist

# Rebuild
cd /root/academic.daily.app/frontend
npm run build

# Check Nginx errors
sudo tail -f /var/log/nginx/daily-academic-error.log
```

### API Calls Failing

1. Check if backend is running: `curl http://127.0.0.1:8000`
2. Check Nginx proxy: `curl http://localhost/api/`
3. Check browser console for CORS errors
4. Verify CORS settings in `backend/main.py`

### Permission Issues

```bash
# Ensure proper permissions for frontend build
sudo chmod -R 755 /root/academic.daily.app/frontend/dist

# Ensure log directories are writable
sudo chmod -R 755 /var/log/gunicorn
sudo chmod -R 755 /var/log/academic-daily-backend
```

## Monitoring

### Set Up Log Rotation

Create `/etc/logrotate.d/academic-daily`:

```
/var/log/nginx/daily-academic-*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 `cat /var/run/nginx.pid`
    endscript
}

/var/log/gunicorn/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 root root
}
```

## Performance Optimization

The current configuration includes:

- **Gzip compression** for text content
- **Asset caching** (1 year for static assets)
- **Multiple Gunicorn workers** (based on CPU cores)
- **Worker recycling** to prevent memory leaks

## Backup Recommendations

Regularly backup:

1. Database (see your database backup strategy)
2. `/root/academic.daily.app/` directory
3. `/etc/nginx/sites-available/daily-academic`
4. `/etc/systemd/system/academic-daily-backend.service`

## Updates and Maintenance

### Update Application

```bash
# Pull latest code
cd /root/academic.daily.app
git pull

# Update backend
cd backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart academic-daily-backend

# Update frontend
cd ../frontend
npm install
npm run build
```

---

## Support

If you encounter issues:

1. Check logs: `sudo journalctl -u academic-daily-backend -f`
2. Check Nginx logs: `sudo tail -f /var/log/nginx/daily-academic-error.log`
3. Verify all services are running: `sudo systemctl status nginx academic-daily-backend`
