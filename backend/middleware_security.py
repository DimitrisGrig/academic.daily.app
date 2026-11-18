"""
Security middleware for blocking common attack patterns and rate limiting.
Protects against:
- Common vulnerability scans (phpunit, .env, etc.)
- Path traversal attempts
- SQL injection patterns
- Excessive requests from single IPs
"""
from fastapi import Request, HTTPException
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from collections import defaultdict
import re
import time
import models
from database import get_local_db


# Trusted proxy IPs — only these are allowed to set X-Forwarded-For.
# Your nginx runs on localhost, so we only trust loopback addresses.
TRUSTED_PROXIES = {"127.0.0.1", "::1"}

# How often (in seconds) to run the full cleanup of ip_request_counts.
# Keeps memory bounded even for high-cardinality legitimate traffic.
CLEANUP_INTERVAL = 300  # every 5 minutes


class SecurityMiddleware(BaseHTTPMiddleware):
    """
    Security middleware that blocks malicious requests before they reach the application.

    Features:
    - Blocks common vulnerability scan patterns
    - Rate limits by IP address
    - Tracks and blocks repeated attack attempts
    - Logs security alerts to database
    - X-Forwarded-For is only trusted from localhost (nginx proxy)
    - Periodic cleanup of in-memory state to prevent unbounded growth
    """

    # Attack patterns to block immediately
    BLOCKED_PATTERNS = [
        r'/\.env',
        r'/\.git',
        r'/phpunit',
        r'/vendor/phpunit',
        r'/eval-stdin\.php',
        r'/\.\./',  # Path traversal
        r'\.\.\\',  # Windows path traversal
        r'/wp-admin',
        r'/wp-login',
        r'/wordpress',
        r'/admin\.php',
        r'/config\.php',
        r'/console',
        r'/actuator',
        r'/\.aws',
        r'/\.docker',
        r'/__pycache__',
        r'/\.vscode',
        r'/\.idea',
        r'/backup',
        r'/\.sql',
        r'/\.zip',
        r'/\.tar',
        r'/shell\.php',
        r'/cmd\.php',
        r'<script',        # XSS attempt
        r'javascript:',    # XSS attempt
        r'union.*select',  # SQL injection
        r'drop.*table',    # SQL injection
        r"';.*--",         # SQL injection
    ]

    # Compile patterns for efficiency
    BLOCKED_REGEX = re.compile('|'.join(BLOCKED_PATTERNS), re.IGNORECASE)

    # Rate limiting configuration
    RATE_LIMIT_WINDOW = 60          # seconds
    MAX_REQUESTS_PER_WINDOW = 100   # max requests per IP per window

    # IP tracking (class-level; shared across requests within one worker)
    ip_request_counts = defaultdict(list)   # {ip: [timestamp1, timestamp2, ...]}
    blocked_ips = {}                         # {ip: blocked_until_timestamp}
    _attack_counts = defaultdict(int)        # {attack_<ip>: count}
    _last_cleanup = time.time()              # timestamp of last full cleanup

    async def dispatch(self, request: Request, call_next):
        client_ip = self._get_client_ip(request)
        current_time = time.time()

        # Periodic cleanup of stale entries to prevent memory growth
        self._maybe_cleanup(current_time)

        # Check if IP is temporarily blocked
        if client_ip in self.blocked_ips:
            if current_time < self.blocked_ips[client_ip]:
                self._log_security_alert(
                    client_ip,
                    request.url.path,
                    "BLOCKED_IP",
                    f"IP temporarily blocked until {datetime.fromtimestamp(self.blocked_ips[client_ip])}"
                )
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Access forbidden. Too many suspicious requests."}
                )
            else:
                # Unblock IP after timeout
                del self.blocked_ips[client_ip]

        # Check for attack patterns
        if self._is_attack_pattern(request.url.path):
            self._log_security_alert(
                client_ip,
                request.url.path,
                "ATTACK_PATTERN",
                f"Blocked suspicious path: {request.url.path}"
            )
            # Block IP for 1 hour after 3 attack attempts
            self._track_attack_attempt(client_ip)
            return JSONResponse(
                status_code=403,
                content={"detail": "Access forbidden"}
            )

        # Rate limiting
        if not self._check_rate_limit(client_ip, current_time):
            self._log_security_alert(
                client_ip,
                request.url.path,
                "RATE_LIMIT",
                f"Exceeded rate limit: {self.MAX_REQUESTS_PER_WINDOW} requests per {self.RATE_LIMIT_WINDOW}s"
            )
            # Block IP for 10 minutes
            self.blocked_ips[client_ip] = current_time + 600
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please try again later."}
            )

        # Request is safe, proceed
        response = await call_next(request)
        return response

    def _get_client_ip(self, request: Request) -> str:
        """
        Extract real client IP from the request.

        X-Forwarded-For and X-Real-IP are only trusted when the direct TCP
        connection comes from a known trusted proxy (localhost nginx).
        This prevents attackers from spoofing their IP by injecting these
        headers themselves.
        """
        direct_ip = request.client.host if request.client else None

        # Only honour proxy headers when the connection comes from our nginx
        if direct_ip in TRUSTED_PROXIES:
            # X-Forwarded-For can be a comma-separated chain; the leftmost
            # entry is the original client IP as set by nginx.
            forwarded_for = request.headers.get("X-Forwarded-For")
            if forwarded_for:
                return forwarded_for.split(",")[0].strip()

            real_ip = request.headers.get("X-Real-IP")
            if real_ip:
                return real_ip

        # Fallback: use the direct TCP peer address
        return direct_ip or "unknown"

    def _is_attack_pattern(self, path: str) -> bool:
        """Check if request path matches known attack patterns"""
        return bool(self.BLOCKED_REGEX.search(path))

    def _check_rate_limit(self, ip: str, current_time: float) -> bool:
        """
        Check if IP has exceeded rate limit.
        Returns True if within limit, False if exceeded.
        """
        # Clean old timestamps outside the window
        window_start = current_time - self.RATE_LIMIT_WINDOW
        self.ip_request_counts[ip] = [
            ts for ts in self.ip_request_counts[ip]
            if ts > window_start
        ]

        # Check if limit exceeded
        if len(self.ip_request_counts[ip]) >= self.MAX_REQUESTS_PER_WINDOW:
            return False

        # Add current request
        self.ip_request_counts[ip].append(current_time)
        return True

    def _track_attack_attempt(self, ip: str):
        """Track attack attempts and block IP after threshold"""
        attack_key = f"attack_{ip}"
        self._attack_counts[attack_key] += 1

        # Block IP for 1 hour after 3 attack attempts
        if self._attack_counts[attack_key] >= 3:
            self.blocked_ips[ip] = time.time() + 3600  # 1 hour block
            self._log_security_alert(
                ip,
                "multiple",
                "IP_BLOCKED",
                f"IP blocked for 1 hour after {self._attack_counts[attack_key]} attack attempts"
            )

    def _maybe_cleanup(self, current_time: float):
        """
        Periodically evict stale entries from ip_request_counts and
        expired entries from blocked_ips to prevent unbounded memory growth.

        This is safe to call on every request because it short-circuits
        immediately unless the cleanup interval has elapsed.
        """
        if current_time - self.__class__._last_cleanup < CLEANUP_INTERVAL:
            return

        self.__class__._last_cleanup = current_time
        window_start = current_time - self.RATE_LIMIT_WINDOW

        # Remove IPs whose entire request window has expired
        stale_ips = [
            ip for ip, timestamps in list(self.ip_request_counts.items())
            if not any(ts > window_start for ts in timestamps)
        ]
        for ip in stale_ips:
            del self.ip_request_counts[ip]

        # Remove IPs whose block has expired
        expired_blocks = [
            ip for ip, until in list(self.blocked_ips.items())
            if current_time >= until
        ]
        for ip in expired_blocks:
            del self.blocked_ips[ip]

        # Reset attack counters for IPs that are no longer blocked
        # (avoids counters growing forever for scanning bots that move on)
        active_blocked = set(self.blocked_ips.keys())
        stale_attack_keys = [
            k for k in list(self._attack_counts.keys())
            if k.replace("attack_", "", 1) not in active_blocked
        ]
        for k in stale_attack_keys:
            del self._attack_counts[k]

    def _log_security_alert(self, ip: str, path: str, alert_type: str, details: str):
        """Log security alert to database"""
        db = None
        try:
            db = next(get_local_db())
            alert = models.SecurityAlert(
                ip_address=ip,
                request_path=path,
                alert_type=alert_type,
                details=details
            )
            db.add(alert)
            db.commit()
        except Exception as e:
            if db:
                try:
                    db.rollback()
                except Exception:
                    pass
            # Don't let logging errors break security blocking
            print(f"Security alert logging failed: {e}")
        finally:
            if db:
                try:
                    db.close()
                except Exception:
                    pass
