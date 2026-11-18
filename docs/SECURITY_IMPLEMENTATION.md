# Security Implementation Guide

## What Was Added

### 1. Security Middleware (`middleware_security.py`)

Comprehensive security layer that blocks malicious requests **before** they reach your application.

#### Features:

- **Attack Pattern Blocking**: Automatically blocks common vulnerability scans
  - PHPUnit exploits
  - `.env` file access attempts
  - Path traversal attacks (`../`, `..\\`)
  - WordPress/PHP admin panel probing
  - SQL injection patterns
  - XSS attempts
  - Config file access attempts

- **Rate Limiting**:
  - Max 100 requests per 60 seconds per IP
  - Prevents DDoS and brute force attacks
- **IP Tracking & Blocking**:
  - After 3 attack attempts: IP blocked for 1 hour
  - After rate limit exceeded: IP blocked for 10 minutes
  - Automatic unblocking after timeout

- **Security Alert Logging**: All suspicious activity logged to `security_alerts` table

### 2. Database Model (`SecurityAlert` in models.py)

New table to track all security incidents:

- IP address
- Request path
- Alert type (ATTACK_PATTERN, RATE_LIMIT, BLOCKED_IP, IP_BLOCKED)
- Details
- Timestamp

### 3. Integration (main.py)

Security middleware added **before** route logging middleware, ensuring attacks are blocked before being logged.

## Setup Instructions

### 1. Create the Security Alerts Table

```bash
cd /home/dimitris/projects/academic.daily/app/backend
python create_security_alerts_table.py
```

### 2. Restart Your Application

```bash
# If using systemd
sudo systemctl restart academic-daily-backend

# Or if running directly
pkill -f "gunicorn.*main:app"
gunicorn main:app -c gunicorn_config.py
```

### 3. Update Nginx Configuration (Optional but Recommended)

Ensure your nginx passes real client IPs to FastAPI by adding to your nginx.conf:

```nginx
proxy_set_header X-Real-IP $remote_addr;
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
```

## Monitoring Security Alerts

### View Recent Security Alerts

```sql
-- View last 50 security incidents
SELECT
    ip_address,
    alert_type,
    request_path,
    details,
    created_at
FROM security_alerts
ORDER BY created_at DESC
LIMIT 50;
```

### Count Attacks by Type

```sql
SELECT
    alert_type,
    COUNT(*) as count
FROM security_alerts
GROUP BY alert_type
ORDER BY count DESC;
```

### Top Attacking IPs

```sql
SELECT
    ip_address,
    COUNT(*) as attack_count,
    MAX(created_at) as last_attempt
FROM security_alerts
GROUP BY ip_address
ORDER BY attack_count DESC
LIMIT 20;
```

### Recent Blocked IPs

```sql
SELECT
    ip_address,
    details,
    created_at
FROM security_alerts
WHERE alert_type = 'IP_BLOCKED'
ORDER BY created_at DESC
LIMIT 20;
```

## Configuration

### Adjust Rate Limits

Edit [`middleware_security.py`](middleware_security.py):

```python
RATE_LIMIT_WINDOW = 60  # seconds
MAX_REQUESTS_PER_WINDOW = 100  # requests per IP
```

### Add Custom Attack Patterns

Edit `BLOCKED_PATTERNS` list in [`middleware_security.py`](middleware_security.py):

```python
BLOCKED_PATTERNS = [
    r'/your-custom-pattern',
    # ... existing patterns
]
```

### Adjust Block Durations

In [`middleware_security.py`](middleware_security.py):

```python
# After 3 attack attempts - change 3600 (1 hour)
self.blocked_ips[ip] = time.time() + 3600

# After rate limit - change 600 (10 minutes)
self.blocked_ips[client_ip] = current_time + 600
```

## What Happens Now

### For Legitimate Users:

- No change - requests work normally
- Slightly faster response (attacks blocked early)

### For Attackers:

- Attack patterns immediately return `403 Forbidden`
- Excessive requests return `429 Too Many Requests`
- Repeated attacks result in IP blocking
- All attempts are logged

## Security Alert Types

| Type             | Description                       | Action                                 |
| ---------------- | --------------------------------- | -------------------------------------- |
| `ATTACK_PATTERN` | Malicious URL detected            | Request blocked, attempt counted       |
| `RATE_LIMIT`     | Too many requests                 | Request blocked, IP blocked for 10 min |
| `BLOCKED_IP`     | Request from blocked IP           | Request blocked                        |
| `IP_BLOCKED`     | IP blocked after repeated attacks | IP banned for 1 hour                   |

## Troubleshooting

### Legitimate User Blocked

If a legitimate user gets blocked:

1. Check the security_alerts table for their IP
2. Manually unblock by removing from blocked IPs (requires restart)
3. Or wait for automatic unblock (10 min or 1 hour)

### False Positives

If legitimate requests are blocked:

1. Review the pattern that triggered it in security_alerts
2. Adjust or remove the pattern from `BLOCKED_PATTERNS`
3. Restart the application

## Next Steps

Consider adding:

1. **Email alerts** for high-severity incidents
2. **Whitelist** for known good IPs (office, CI/CD servers)
3. **Permanent IP bans** for repeated offenders
4. **Geographic filtering** if you serve specific regions
5. **Dashboard** to visualize security metrics

## Current Protection Against Your Logged Attacks

Looking at your logs, these are now blocked:

✅ `/vendor/phpunit/phpunit/src/Util/PHP/eval-stdin.php` - **BLOCKED** (PHPUnit pattern)  
✅ `/.env` - **BLOCKED** (env file pattern)  
✅ Generic attack probing - **BLOCKED** (multiple patterns matched)

Anonymous and authenticated users can still access legitimate routes normally.
