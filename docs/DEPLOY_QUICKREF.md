# 🚀 Quick Deployment Reference

## Deploy Now

```bash
cd /root/academic.daily.app
sudo ./deploy.sh
```

## Common Commands

### 🔍 Check Status
```bash
sudo systemctl status nginx
sudo systemctl status academic-daily-backend
```

### 📋 View Logs
```bash
# Backend logs
sudo journalctl -u academic-daily-backend -f

# Nginx logs
sudo tail -f /var/log/nginx/daily-academic-error.log
```

### 🔄 Restart Services
```bash
sudo systemctl restart academic-daily-backend
sudo systemctl restart nginx
```

### 🏗️ Rebuild Frontend
```bash
cd /root/academic.daily.app/frontend
npm run build
```

### 🔧 Update Backend
```bash
cd /root/academic.daily.app/backend
source venv/bin/activate
pip install -r requirements.txt
deactivate
sudo systemctl restart academic-daily-backend
```

## URLs

- **Website**: http://app.daily-academic.com
- **Backend** (localhost only): http://127.0.0.1:8000
- **API through Nginx**: http://app.daily-academic.com/api/

## 🔐 Enable HTTPS

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d app.daily-academic.com
```

## ⚠️ Troubleshooting

**Backend not starting?**
```bash
sudo journalctl -u academic-daily-backend -n 50
```

**Frontend not loading?**
```bash
ls /root/academic.daily.app/frontend/dist
sudo nginx -t
```

**API calls failing?**
```bash
curl http://127.0.0.1:8000
curl http://localhost/api/
```

## 📁 Important Files

| File | Purpose |
|------|---------|
| `/etc/nginx/sites-available/daily-academic` | Nginx config |
| `/etc/systemd/system/academic-daily-backend.service` | Backend service |
| `/root/academic.daily.app/backend/gunicorn_config.py` | Gunicorn config |
| `/root/academic.daily.app/frontend/.env.production` | Frontend production env |

## 🎯 After Deployment

1. Visit http://app.daily-academic.com
2. Check backend: `curl http://127.0.0.1:8000`
3. Check logs: `sudo journalctl -u academic-daily-backend -f`
4. Enable HTTPS with certbot
5. Test all features

---

For detailed information, see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
