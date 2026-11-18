# Route Logging System

## Overview

This application uses **middleware-based automatic logging** to track all API route requests in the `log_routes` table.

## How It Works

The `RouteLoggingMiddleware` in `middleware_logging.py` automatically:
- Logs every API request (except health checks)
- Extracts user information from JWT tokens
- Captures query parameters and request body data
- Stores logs in the `LogRoutes` database table

## Database Schema

```sql
-- models.LogRoutes
id: Integer (Primary Key)
username: String (extracted from JWT or "anonymous")
datetime: DateTime (auto-generated)
requested_route: String (e.g., "/bookmarks/get_folders")
requested_params: String (query parameters)
requested_params_data: String (request body, limited to 500 chars)
```

## Benefits

✅ **Automatic** - No manual calls needed in route handlers
✅ **Consistent** - All routes logged the same way
✅ **Safe** - Errors in logging don't break requests
✅ **Complete** - Captures all requests including failed auth attempts
✅ **Maintainable** - Single place to modify logging behavior

## Configuration

The middleware is registered in `main.py`:

```python
from middleware_logging import RouteLoggingMiddleware

app.add_middleware(RouteLoggingMiddleware)
```

## Excluded Routes

The following routes are NOT logged to reduce noise:
- `/` (root/health check)
- `/docs` (API documentation)
- `/openapi.json` (OpenAPI schema)
- `/redoc` (ReDoc documentation)

## Viewing Logs

Query the `log_routes` table:

```sql
-- Recent logs
SELECT * FROM log_routes ORDER BY datetime DESC LIMIT 100;

-- Logs for specific user
SELECT * FROM log_routes WHERE username = 'user@example.com' ORDER BY datetime DESC;

-- Most accessed routes
SELECT requested_route, COUNT(*) as count 
FROM log_routes 
GROUP BY requested_route 
ORDER BY count DESC;
```

## Migration from Old System

The old manual `log_route()` function in `fnc.py` is **deprecated**. 

**Before (Manual):**
```python
@router.get("/get_folders")
def get_bookmark_folders(request: Request, current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    log_route(token, request=request, requested_params_data=None, db=db)  # ❌ Not needed
    # ... route logic
```

**After (Automatic):**
```python
@router.get("/get_folders")
def get_bookmark_folders(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    # ... route logic (middleware handles logging automatically) ✅
```

## Performance Considerations

- Logging uses a separate database session
- Request body is limited to 500 characters
- Logging errors are caught and don't affect the main request
- Minimal overhead (~5-10ms per request)
