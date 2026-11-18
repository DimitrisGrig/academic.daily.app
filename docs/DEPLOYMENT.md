# 🚀 Production Deployment Guide

## Overview

This guide covers deploying your Clerk-authenticated FastAPI + React app to production.

## Prerequisites

- Domain name (recommended)
- SSL certificate (Let's Encrypt recommended)
- Production Clerk account with live keys

## 1. Clerk Production Setup

### Update to Production Keys

1. Go to [Clerk Dashboard](https://dashboard.clerk.com)
2. Switch to **Production** mode (top of dashboard)
3. Get your production keys:
   - `pk_live_...` (Publishable Key)
   - `sk_live_...` (Secret Key)

### Configure Production Settings

1. **Allowed Origins**: Add your production domain
2. **Redirect URLs**: Add production URLs
   - `https://yourdomain.com/*`
3. **OAuth Settings**: Verify Google & Microsoft apps are approved for production

## 2. Backend Deployment

### Option A: Docker Deployment

Create `backend/Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Expose port
EXPOSE 8000

# Run application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

Create `backend/requirements.txt`:

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
python-dotenv==1.0.0
pyjwt[crypto]==2.8.0
python-jose[cryptography]==3.3.0
requests==2.31.0
python-multipart==0.0.6
```

Create `backend/docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "8000:8000"
    environment:
      - CLERK_PUBLISHABLE_KEY=${CLERK_PUBLISHABLE_KEY}
      - CLERK_SECRET_KEY=${CLERK_SECRET_KEY}
      - db_host=${db_host}
      - db_port=${db_port}
      - db_name=${db_name}
      - db_user=${db_user}
      - db_password=${db_password}
    restart: unless-stopped
```

Deploy:
```bash
docker-compose up -d
```

### Option B: Traditional Deployment (Ubuntu/Debian)

```bash
# Install Python and dependencies
sudo apt update
sudo apt install python3 python3-pip nginx

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
sudo nano /etc/environment
# Add your production .env variables

# Create systemd service
sudo nano /etc/systemd/system/fastapi.service
```

`/etc/systemd/system/fastapi.service`:
```ini
[Unit]
Description=FastAPI Application
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/var/www/your-app/backend
Environment="PATH=/var/www/your-app/backend/venv/bin"
EnvironmentFile=/var/www/your-app/backend/.env
ExecStart=/var/www/your-app/backend/venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000

[Install]
WantedBy=multi-user.target
```

Start service:
```bash
sudo systemctl start fastapi
sudo systemctl enable fastapi
```

### Configure Nginx Reverse Proxy

`/etc/nginx/sites-available/your-app`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/your-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Add SSL with Let's Encrypt

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.yourdomain.com
```

## 3. Frontend Deployment

### Update Environment Variables

Create `frontend/.env.production`:

```env
VITE_CLERK_PUBLISHABLE_KEY=pk_live_your_production_key
VITE_API_URL=https://api.yourdomain.com
```

### Build for Production

```bash
cd frontend
npm run build
```

### Option A: Deploy to Vercel

```bash
npm install -g vercel
vercel --prod
```

In Vercel dashboard:
- Add environment variables
- Configure domain

### Option B: Deploy to Netlify

Create `frontend/netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

Deploy:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Option C: Deploy to Nginx

```bash
# Build the app
npm run build

# Copy to web server
sudo cp -r dist/* /var/www/your-app/frontend/
```

`/etc/nginx/sites-available/your-app-frontend`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    root /var/www/your-app/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

Add SSL:
```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

## 4. Database Setup

### PostgreSQL Production Setup

```bash
# Install PostgreSQL
sudo apt install postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql

CREATE DATABASE your_database;
CREATE USER your_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE your_database TO your_user;
\q
```

### Connection Security

- Use SSL connections
- Restrict access by IP
- Use strong passwords
- Regular backups

## 5. Security Checklist

### Backend
- [ ] Use HTTPS only
- [ ] Update CORS to specific domains
- [ ] Enable rate limiting
- [ ] Set up proper logging
- [ ] Use environment variables for secrets
- [ ] Enable SQL injection protection
- [ ] Set up firewall rules

### Frontend
- [ ] Use HTTPS only
- [ ] Enable CSP headers
- [ ] Minimize exposed API keys
- [ ] Use production Clerk keys
- [ ] Enable HSTS

### Clerk
- [ ] Use production mode
- [ ] Configure allowed domains
- [ ] Set up webhook endpoints
- [ ] Enable MFA options
- [ ] Review security settings

## 6. Update CORS for Production

`backend/main.py`:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://yourdomain.com",
        "https://www.yourdomain.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## 7. Monitoring & Logging

### Set Up Logging

```python
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)
```

### Monitor Application

- Use tools like:
  - **Sentry** for error tracking
  - **Datadog** for monitoring
  - **CloudWatch** (AWS)
  - **Google Cloud Monitoring**

## 8. Performance Optimization

### Backend
```python
# Add caching
from fastapi_cache import FastAPICache
from fastapi_cache.backends.redis import RedisBackend

# Enable compression
app.add_middleware(GZipMiddleware, minimum_size=1000)
```

### Frontend
- Enable code splitting
- Optimize images
- Use CDN for static assets
- Enable browser caching
- Minimize bundle size

## 9. Backup Strategy

### Database Backups

```bash
# Daily backup script
pg_dump -U your_user your_database > backup_$(date +%Y%m%d).sql

# Automated backups with cron
0 2 * * * /path/to/backup-script.sh
```

### Application Backups

- Version control (Git)
- Regular snapshots
- Offsite backups

## 10. Deployment Checklist

- [ ] Production Clerk keys configured
- [ ] Database setup and secured
- [ ] SSL certificates installed
- [ ] CORS configured for production domain
- [ ] Environment variables set
- [ ] Backend deployed and running
- [ ] Frontend built and deployed
- [ ] DNS configured correctly
- [ ] Health checks passing
- [ ] Error tracking configured
- [ ] Backups scheduled
- [ ] Monitoring enabled

## 11. Testing Production

```bash
# Test API
curl https://api.yourdomain.com/

# Test authentication
# Login via frontend and check Network tab

# Test protected endpoints
curl -H "Authorization: Bearer YOUR_TOKEN" \
  https://api.yourdomain.com/api/protected
```

## 12. Rollback Plan

Keep previous versions:
```bash
# Tag releases
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Quick rollback
git checkout v1.0.0
# Redeploy
```

## Resources

- [Clerk Production Checklist](https://clerk.com/docs/deployments/production-checklist)
- [FastAPI Deployment](https://fastapi.tiangolo.com/deployment/)
- [React Production Build](https://react.dev/learn/production)

---

**Important**: Always test in a staging environment before deploying to production!
