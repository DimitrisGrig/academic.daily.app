# Gunicorn configuration file for FastAPI backend
# This ensures the backend only listens on localhost (127.0.0.1)

import multiprocessing

# Bind to localhost only - not accessible from outside
bind = "127.0.0.1:8000"

# Worker processes
# Reduced for ML workloads - each worker loads heavy models (FAISS, transformers)
# Use fewer workers to reduce memory consumption
workers = 2  # Was: multiprocessing.cpu_count() * 2 + 1 (9 workers)
worker_class = "uvicorn.workers.UvicornWorker"

# Logging
accesslog = "/var/log/gunicorn/access.log"
errorlog = "/var/log/gunicorn/error.log"
loglevel = "info"

# Process naming
proc_name = "academic_daily_api"

# Timeout settings (in seconds)
timeout = 120
keepalive = 5

# Graceful timeout
graceful_timeout = 30

# Max requests per worker before restart (prevent memory leaks)
# Reduced to restart more frequently due to ML model memory accumulation
max_requests = 500  # Restart after 1000 requests (increased from 500 for stability)
max_requests_jitter = 50

# Worker lifecycle management
# Restart workers after this many seconds to prevent memory leaks
# With ML models/FAISS, memory accumulates even without many requests
max_age = 3600  # Restart workers after 1 hour (was 1 hour - increased for stability)
max_age_jitter = 300  # Add randomness ±5 minutes

# Security
limit_request_line = 4096
limit_request_fields = 100
limit_request_field_size = 8190


def post_fork(server, worker):
    """
    Pre-load the BioBERT model immediately after each worker process is forked.
    Without this, each worker loads the model on its very first request, causing
    visible latency and repeated '[INFO] Loading BioBERT model...' log lines every
    time a restarted worker serves its first request.
    """
    try:
        from fnc import get_model
        get_model()
        server.log.info(f"[Worker {worker.pid}] BioBERT model pre-loaded")
    except Exception as exc:
        server.log.error(f"[Worker {worker.pid}] BioBERT pre-load failed: {exc}")
