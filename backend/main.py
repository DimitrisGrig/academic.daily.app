from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer

import models, user_models
from database import engine, get_local_db
from middleware_logging import RouteLoggingMiddleware
from middleware_security import SecurityMiddleware

models.Base.metadata.create_all(bind=engine)
user_models.Base.metadata.create_all(bind=engine)

from routers import auth_routes, user_routes, customFeeds, bookmarks, mainFeed, scheduler_jobs, user_actions, comments, history, explore, onboarding_routes, tags_routes, settings, source_journals, notification, metrics, search, testimonials, mail_digests, admin, bioarchive, groups, webhooks, journal_icons, zotero, topic_routes, public, geo

from fastapi_cache import FastAPICache
from fastapi_cache.backends.inmemory import InMemoryBackend
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from limiter import limiter
from contextlib import asynccontextmanager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize cache with size limits to prevent unbounded memory growth
    FastAPICache.init(
        InMemoryBackend(),
        prefix="fastapi-cache",
        expire=3600  # Default expiration: 1 hour
    )
    # Pre-load BioBERT so the first real request is never the one paying the
    # model-load cost.  Under gunicorn this is also done in post_fork(), but
    # running via plain `uvicorn` (dev) hits this path instead.
    try:
        from fnc import get_model
        import asyncio
        await asyncio.get_event_loop().run_in_executor(None, get_model)
    except Exception as exc:
        print(f"[WARNING] BioBERT pre-load failed at startup: {exc}")
    yield
    # Cleanup on shutdown
    await FastAPICache.clear()
    
app = FastAPI(lifespan=lifespan)

# slowapi: attach the limiter to the app state and register its error handler
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# app.include_router(scheduler_jobs.router)
app.include_router(auth_routes.router)
app.include_router(user_routes.router)
app.include_router(customFeeds.router)
app.include_router(bookmarks.router)
app.include_router(mainFeed.router)
app.include_router(scheduler_jobs.router)
app.include_router(user_actions.router)
app.include_router(comments.router, prefix="/comments", tags=["comments"])
app.include_router(history.router, prefix="/history", tags=["history"])
app.include_router(explore.router)
app.include_router(onboarding_routes.router)
app.include_router(tags_routes.router)
app.include_router(settings.router)
app.include_router(source_journals.router)
app.include_router(notification.router)
app.include_router(metrics.router)
app.include_router(search.router)
app.include_router(testimonials.router, prefix="/testimonials", tags=["testimonials"])
app.include_router(mail_digests.router)
app.include_router(bioarchive.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(webhooks.router)
app.include_router(journal_icons.router)
app.include_router(zotero.router)
app.include_router(topic_routes.router)
app.include_router(public.router)
app.include_router(geo.router)

# Initialize job scheduler
app.router.lifespan_context = scheduler_jobs.lifespan


# Add security middleware FIRST (before any other middleware)
app.add_middleware(SecurityMiddleware)

# Add route logging middleware (before CORS)
app.add_middleware(RouteLoggingMiddleware)


# CORS configuration - must specify exact origins when using credentials
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Local development
        "http://127.0.0.1:5173",  # Alternative localhost
        "http://localhost:8888",  # Local preview
        "http://app.daily-academic.com",  # Production domain
        "https://app.daily-academic.com",  # Production domain (HTTPS)
        "http://www.daily-academic.com",  # Landing page
        "https://www.daily-academic.com",  # Landing page (HTTPS)
        "http://daily-academic.com",  # Landing page (no www)
        "https://daily-academic.com",  # Landing page (no www, HTTPS)
    ],
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods (GET, POST, PUT, DELETE, etc.)
    allow_headers=["*"],  # Allows all headers
)


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/login/token")

@app.get("/")
async def read_root():
    return "Server is running."
