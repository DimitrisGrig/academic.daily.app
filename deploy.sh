#!/bin/bash

# Deployment script for Daily Academic App
# This script sets up Nginx, builds the frontend, and configures the backend service

set -e  # Exit on any error

echo "=========================================="
echo "Daily Academic App - Deployment Setup"
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run as root or with sudo${NC}"
    exit 1
fi

echo -e "${YELLOW}Step 1: Installing/Updating Nginx...${NC}"
# apt update
# apt install -y nginx

echo -e "${YELLOW}Step 2: Creating log directories...${NC}"
mkdir -p /var/log/gunicorn
mkdir -p /var/log/academic-daily-backend
mkdir -p /var/www/certbot

echo -e "${YELLOW}Step 3: Installing Node.js and npm...${NC}"
# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Node.js not found. Installing Node.js 20.x LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
    echo "Node.js version: $(node --version)"
    echo "npm version: $(npm --version)"
else
    echo "Node.js already installed: $(node --version)"
    echo "npm version: $(npm --version)"
fi

echo -e "${YELLOW}Step 4: Installing Python dependencies (gunicorn)...${NC}"
cd /root/academic.daily.app/backend
source venv/bin/activate
pip install gunicorn uvicorn[standard]
deactivate

echo -e "${YELLOW}Step 5: Building React frontend...${NC}"
cd /root/academic.daily.app/frontend

# Check if node_modules exists, if not install dependencies
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi

# Create production build
npm run build

echo -e "${YELLOW}Step 6: Configuring Nginx...${NC}"
# Backup existing nginx config if it exists
if [ -f /etc/nginx/sites-available/daily-academic ]; then
    cp /etc/nginx/sites-available/daily-academic /etc/nginx/sites-available/daily-academic.backup.$(date +%Y%m%d_%H%M%S)
fi

# Copy nginx configuration
cp /root/academic.daily.app/nginx.conf /etc/nginx/sites-available/daily-academic

# Enable the site
ln -sf /etc/nginx/sites-available/daily-academic /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

echo -e "${YELLOW}Step 7: Setting up FastAPI backend service...${NC}"
# Copy systemd service file
cp /root/academic.daily.app/academic-daily-backend.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable and start the backend service
systemctl enable academic-daily-backend.service
systemctl restart academic-daily-backend.service

echo -e "${YELLOW}Step 8: Restarting Nginx...${NC}"
systemctl restart nginx

echo ""
echo -e "${GREEN}=========================================="
echo "Deployment Complete!"
echo "==========================================${NC}"
echo ""
echo "Your application should now be running at:"
echo "  - http://app.daily-academic.com"
echo ""
echo "Backend API is running on localhost:8000 (not publicly accessible)"
echo ""
echo "Useful commands:"
echo "  - Check backend status: systemctl status academic-daily-backend"
echo "  - View backend logs: journalctl -u academic-daily-backend -f"
echo "  - Check Nginx status: systemctl status nginx"
echo "  - View Nginx logs: tail -f /var/log/nginx/daily-academic-error.log"
echo ""
echo -e "${YELLOW}To enable HTTPS with Let's Encrypt:${NC}"
echo "  1. Install certbot: apt install certbot python3-certbot-nginx"
echo "  2. Run: certbot --nginx -d app.daily-academic.com"
echo "  3. Uncomment the HTTPS server block in /etc/nginx/sites-available/daily-academic"
echo "  4. Restart Nginx: systemctl restart nginx"
echo ""
