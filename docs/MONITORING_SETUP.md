# Cron Job Setup for Memory Monitoring

## Install the monitoring script

```bash
# Copy script to system location
sudo cp /root/academic.daily.app/monitor-backend-memory.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/monitor-backend-memory.sh

# Create log directory
sudo mkdir -p /var/log
sudo touch /var/log/academic-daily-memory.log
sudo chown root:root /var/log/academic-daily-memory.log
```

## Add to crontab

```bash
# Edit root crontab
sudo crontab -e
```

Add these lines:

```cron
# Check memory every 15 minutes
*/15 * * * * /usr/local/bin/monitor-backend-memory.sh >> /var/log/academic-daily-memory-check.log 2>&1

# Daily summary at 9 AM
0 9 * * * /usr/local/bin/monitor-backend-memory.sh | mail -s "Daily Backend Memory Report" your-email@example.com
```

## Manual Usage

```bash
# Run immediately
/root/academic.daily.app/monitor-backend-memory.sh

# Or from system location
/usr/local/bin/monitor-backend-memory.sh
```

## Example Output

```
======================================
Academic Daily Backend Memory Report
Timestamp: 2026-02-13 14:30:45
======================================
Worker PID 12345: 1850 MB (CPU: 12.3%) - OK
Worker PID 12346: 1920 MB (CPU: 15.1%) - OK
======================================
Workers: 2
Total Memory: 3770 MB
Average per Worker: 1885 MB
Max Worker: 1920 MB
======================================

Recent FAISS Activity:
✅ Using cached FAISS index: /path/to/index_flat
📦 Using cached FAISS results for explore

Memory Trend (last 5 checks):
2026-02-13 14:00:45 Memory:1820MB
2026-02-13 14:15:45 Memory:1845MB
2026-02-13 14:30:45 Memory:1850MB
======================================
```

## View Logs

```bash
# Real-time monitoring
tail -f /var/log/academic-daily-memory.log

# Daily summary
grep "$(date +%Y-%m-%d)" /var/log/academic-daily-memory.log

# Memory over time (CSV format)
cat /var/log/academic-daily-memory.log | cut -d',' -f1,3

# Average memory today
grep "$(date +%Y-%m-%d)" /var/log/academic-daily-memory.log | \
  awk -F'Memory:|MB' '{sum+=$2; count++} END {print "Average:", sum/count, "MB"}'
```

## Log Rotation

Create `/etc/logrotate.d/academic-daily`:

```
/var/log/academic-daily-memory.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}

/var/log/academic-daily-memory-check.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
    create 0644 root root
}
```

## Alerting (Optional)

### Email alerts on critical memory:

Add to the script (uncomment the auto-restart section) or create separate alert:

```bash
# Save as /usr/local/bin/memory-alert.sh
#!/bin/bash
OUTPUT=$(/usr/local/bin/monitor-backend-memory.sh)

if echo "$OUTPUT" | grep -q "CRITICAL"; then
    echo "$OUTPUT" | mail -s "⚠️ CRITICAL: Backend Memory High" your-email@example.com
    
    # Optional: Send to Slack/Discord webhook
    # curl -X POST YOUR_WEBHOOK_URL -H 'Content-Type: application/json' \
    #   -d "{\"text\":\"⚠️ Backend memory critical: see server logs\"}"
fi
```

### Slack/Discord Integration:

```bash
# Add to monitor script
send_alert() {
    WEBHOOK_URL="your-webhook-url"
    MESSAGE="⚠️ Backend memory critical: $1 MB (threshold: $2 MB)"
    
    curl -X POST "$WEBHOOK_URL" \
      -H 'Content-Type: application/json' \
      -d "{\"text\":\"$MESSAGE\"}"
}

# Call when critical
if [ $MEM_MB -gt $CRITICAL_MB ]; then
    send_alert $MEM_MB $CRITICAL_MB
fi
```

## Grafana/Prometheus Integration (Advanced)

Export metrics to Prometheus format:

```bash
# Create /var/www/html/metrics/backend-memory.prom
cat > /var/www/html/metrics/backend-memory.prom << EOF
# HELP backend_worker_memory_mb Memory usage per worker in MB
# TYPE backend_worker_memory_mb gauge
backend_worker_memory_mb{pid="$PID"} $MEM_MB

# HELP backend_total_memory_mb Total memory usage in MB
# TYPE backend_total_memory_mb gauge
backend_total_memory_mb $TOTAL_MEMORY
EOF
```

Then scrape with Prometheus config:
```yaml
scrape_configs:
  - job_name: 'backend-memory'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics/backend-memory.prom'
```

---

## Quick Reference

```bash
# Check current status
/root/academic.daily.app/monitor-backend-memory.sh

# View logs
tail -f /var/log/academic-daily-memory.log

# Check if cron is running
sudo crontab -l | grep monitor

# Test email alerts
echo "Test" | mail -s "Test" your-email@example.com
```
