# Quick Memory Leak Fix Reference

## Files Changed

1. ✅ `backend/vector_store/FAISS.py` - Added global caching for FAISS indices
2. ✅ `backend/database.py` - Fixed connection pool settings
3. ✅ `backend/routers/scheduler_jobs.py` - Fixed session cleanup
4. ✅ `backend/main.py` - Added cache expiration and cleanup
5. ✅ `backend/gunicorn_config.py` - Adjusted worker restart frequency

## Deploy Commands

```bash
cd /root/academic.daily.app

# Check what changed
git status

# Review changes (optional)
git diff backend/vector_store/FAISS.py
git diff backend/database.py

# Commit changes
git add backend/vector_store/FAISS.py
git add backend/database.py
git add backend/routers/scheduler_jobs.py
git add backend/main.py
git add backend/gunicorn_config.py
git add MEMORY_LEAK_FIXES.md
git add MEMORY_LEAK_QUICKREF.md

git commit -m "Fix critical memory leaks: FAISS caching, DB pool config, improved worker lifecycle"

# Push to repository (optional)
git push origin master

# Restart backend
sudo systemctl restart academic-daily-backend.service

# Check status
sudo systemctl status academic-daily-backend.service

# Monitor logs
sudo journalctl -u academic-daily-backend.service -f
```

## Verify Fixes Working

### 1. Check FAISS caching (should see cache hits):
```bash
sudo journalctl -u academic-daily-backend.service --since "5 minutes ago" | grep -i "faiss\|cached"
```

Expected output after startup:
```
✅ Loaded FLAT index from: /path/to/index
💾 Cached FAISS index: /path/to/index_flat
✅ Using cached FAISS index: /path/to/index_flat  <-- This is good!
```

### 2. Monitor memory usage:
```bash
# Show memory per worker
ps aux | grep gunicorn | grep -v grep

# Total memory used
ps aux | grep gunicorn | grep -v grep | awk '{sum+=$6} END {print sum/1024 " MB"}'

# Watch in real-time
watch -n 5 'ps aux | grep gunicorn | grep -v grep'
```

### 3. Check for errors:
```bash
sudo journalctl -u academic-daily-backend.service --since "10 minutes ago" | grep -i error
```

## Expected Results

### Memory Usage (per worker):
- **Before**: 3-8 GB per worker (growing over time)
- **After**: 1-3 GB per worker (stable)

### Behavior:
- ✅ First FAISS request loads index (prints "Loaded FLAT index")
- ✅ Subsequent requests use cache (prints "Using cached FAISS index")
- ✅ Memory stays stable over hours
- ✅ No more frequent restarts needed

## Rollback (if needed)

If something breaks:
```bash
cd /root/academic.daily.app
git log --oneline -5  # Find commit before changes
git revert <commit-hash>
sudo systemctl restart academic-daily-backend.service
```

## Still Having Issues?

### If memory still high after 24 hours:

1. **Check which process is using memory:**
```bash
ps aux --sort=-%mem | head -10
```

2. **Enable detailed logging:**
```bash
# Edit gunicorn_config.py
loglevel = "debug"  # Change from "info"
echo_pool = True    # In database.py

sudo systemctl restart academic-daily-backend.service
sudo journalctl -u academic-daily-backend.service -f
```

3. **Check for other leaks:**
```bash
# Install memory profiler
pip install memory-profiler

# Add to a suspect route:
from memory_profiler import profile

@profile
def your_route():
    ...
```

4. **Contact for help with:**
   - Current memory usage: `ps aux | grep gunicorn`
   - Recent logs: `sudo journalctl -u academic-daily-backend.service --since "1 hour ago"`
   - FAISS cache status from logs

## Success Indicators

After deployment, within 1 hour you should see:
- ✅ Memory usage drops 40-60%
- ✅ Memory stays stable (not climbing)
- ✅ Logs show "Using cached FAISS index"
- ✅ No more emergency restarts needed

## Performance Notes

- First request after worker start: ~2-3 seconds (loading FAISS)
- Subsequent requests: <100ms (using cache)
- Worker restarts every ~2 hours (normal, healthy)
- Database connections reused efficiently

---

**TL;DR**: Deploy → Restart → Monitor logs for cache hits → Enjoy stable memory! 🎉
