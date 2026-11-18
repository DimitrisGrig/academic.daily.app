#!/bin/bash
# Memory Monitoring Script for Academic Daily Backend
# Save as: /usr/local/bin/monitor-backend-memory.sh
# Make executable: chmod +x /usr/local/bin/monitor-backend-memory.sh

# Configuration
MAX_MEMORY_MB=5120  # 5GB warning threshold per worker
CRITICAL_MB=7168    # 7GB critical threshold per worker
LOG_FILE="/var/log/academic-daily-memory.log"
SERVICE_NAME="academic-daily-backend.service"

# Colors for output
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Get timestamp
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

# Find all gunicorn workers
WORKER_PIDS=$(pgrep -f "gunicorn.*main:app")

if [ -z "$WORKER_PIDS" ]; then
    echo -e "${RED}[ERROR]${NC} No gunicorn workers found!"
    exit 1
fi

# Track total and max memory
TOTAL_MEMORY=0
MAX_WORKER_MEMORY=0
WORKER_COUNT=0
CRITICAL_WORKER=0

echo "======================================"
echo "Academic Daily Backend Memory Report"
echo "Timestamp: $TIMESTAMP"
echo "======================================"

for PID in $WORKER_PIDS; do
    # Get memory in KB, convert to MB
    MEM_KB=$(ps -o rss= -p $PID 2>/dev/null)
    
    if [ -z "$MEM_KB" ]; then
        continue
    fi
    
    MEM_MB=$((MEM_KB / 1024))
    TOTAL_MEMORY=$((TOTAL_MEMORY + MEM_MB))
    WORKER_COUNT=$((WORKER_COUNT + 1))
    
    # Track max
    if [ $MEM_MB -gt $MAX_WORKER_MEMORY ]; then
        MAX_WORKER_MEMORY=$MEM_MB
    fi
    
    # Determine status
    STATUS="OK"
    COLOR=$GREEN
    
    if [ $MEM_MB -gt $MAX_MEMORY_MB ]; then
        STATUS="WARNING"
        COLOR=$YELLOW
    fi
    
    if [ $MEM_MB -gt $CRITICAL_MB ]; then
        STATUS="CRITICAL"
        COLOR=$RED
        CRITICAL_WORKER=1
    fi
    
    # Get CPU usage
    CPU=$(ps -o %cpu= -p $PID)
    
    echo -e "${COLOR}Worker PID $PID: ${MEM_MB} MB (CPU: ${CPU}%) - $STATUS${NC}"
    
    # Log to file
    echo "$TIMESTAMP,PID:$PID,Memory:${MEM_MB}MB,CPU:${CPU}%,Status:$STATUS" >> $LOG_FILE
done

AVG_MEMORY=$((TOTAL_MEMORY / WORKER_COUNT))

echo "======================================"
echo "Workers: $WORKER_COUNT"
echo "Total Memory: ${TOTAL_MEMORY} MB"
echo "Average per Worker: ${AVG_MEMORY} MB"
echo "Max Worker: ${MAX_WORKER_MEMORY} MB"
echo "======================================"

# Check FAISS cache status from recent logs
echo ""
echo "Recent FAISS Activity:"
sudo journalctl -u $SERVICE_NAME --since "5 minutes ago" 2>/dev/null | grep -i "faiss\|cached" | tail -5

# Action if critical
if [ $CRITICAL_WORKER -eq 1 ]; then
    echo -e "\n${RED}⚠️  CRITICAL: Worker memory exceeded ${CRITICAL_MB}MB!${NC}"
    echo "Recommendation: Restart service"
    echo "Command: sudo systemctl restart $SERVICE_NAME"
    
    # Optional: Auto-restart (uncomment to enable)
    # echo "Auto-restarting service..."
    # sudo systemctl restart $SERVICE_NAME
    # echo "Service restarted at $TIMESTAMP"
fi

# Memory trend (last 5 entries)
echo ""
echo "Memory Trend (last 5 checks):"
tail -5 $LOG_FILE 2>/dev/null | awk -F',' '{print $1, $3}' || echo "No history yet"

echo ""
echo "======================================"
