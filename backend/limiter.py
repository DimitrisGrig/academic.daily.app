"""
Shared slowapi Limiter instance.

Import this module in main.py (to register the error handler and state) and
in any router that needs per-route rate limiting.

Usage in a router:
    from limiter import limiter
    from fastapi import Request

    @router.get("/my-endpoint")
    @limiter.limit("10/minute")
    async def my_endpoint(request: Request, ...):
        ...
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Uses the real client IP as the rate-limit key.
# get_remote_address reads request.client.host, which — after our
# SecurityMiddleware fix — already returns the correct IP (either the
# direct peer for raw connections, or the value nginx placed in
# X-Forwarded-For when the request came through localhost).
limiter = Limiter(key_func=get_remote_address)
