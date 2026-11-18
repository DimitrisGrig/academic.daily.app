from vector_store.update_user_embedings import wrapper_update_user_embeddings_cache
from extract_mesh_to_topics import extract_mesh_terms_job
from vector_store.FAISS import clear_faiss_cache, get_cache_stats
from vector_store.bm25 import clear_bm25_cache
from fnc import *
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request
import models, schemas
from database import engine, get_local_db
from sqlalchemy import text
import requests
import os
from dotenv import load_dotenv
from user_models import User

load_dotenv()

models.Base.metadata.create_all(bind=engine)

from apscheduler.schedulers.background import BackgroundScheduler
from contextlib import asynccontextmanager

router = APIRouter(
    prefix="/scheduler_jobs",
    tags=["scheduler_jobs"]
)


# Use lifespan event handlers
@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.start()
    yield
    scheduler.shutdown()


def get_db():
    """Get a database session for scheduler jobs with proper cleanup"""
    db = next(get_local_db())
    try:
        return db
    except Exception:
        db.close()
        raise


scheduler = BackgroundScheduler()


# -------------------------------------------------------- #
#                     ADVISORY LOCK                        #
# -------------------------------------------------------- #

def with_advisory_lock(lock_id: int):
    """Decorator: use a PostgreSQL advisory lock so only one gunicorn
    worker executes the job; the other workers skip silently.
    This prevents duplicate emails / duplicate DB writes when running
    multiple gunicorn workers that each start their own scheduler."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            db = next(get_local_db())
            try:
                acquired = db.execute(
                    text("SELECT pg_try_advisory_lock(:id)"), {"id": lock_id}
                ).scalar()
                if not acquired:
                    print(f"[Scheduler] {func.__name__} skipped – another worker holds lock {lock_id}")
                    return
                try:
                    return func(*args, **kwargs)
                finally:
                    db.execute(text("SELECT pg_advisory_unlock(:id)"), {"id": lock_id})
                    db.commit()
            finally:
                db.close()
        wrapper.__name__ = func.__name__
        return wrapper
    return decorator


# -------------------------------------------------------- #
#                           JOBS                           #
# -------------------------------------------------------- #

def sync_clerk_users_job():
    """
    Scheduled job to sync all users from Clerk to the local database.
    Runs every 24 hours.
    """
    db = get_db()
    
    try:
        CLERK_SECRET_KEY = os.getenv("CLERK_SECRET_KEY")
        
        if not CLERK_SECRET_KEY:
            print("Error: Clerk secret key not configured")
            return
        
        clerk_api_url = "https://api.clerk.com/v1"
        
        headers = {
            "Authorization": f"Bearer {CLERK_SECRET_KEY}",
            "Content-Type": "application/json"
        }
        
        # Fetch all users from Clerk
        all_clerk_users = []
        offset = 0
        limit = 100
        
        while True:
            response = requests.get(f"{clerk_api_url}/users", headers=headers, params={"limit": limit, "offset": offset})
            response.raise_for_status()
            
            users_batch = response.json()
            if not users_batch:
                break
                
            all_clerk_users.extend(users_batch)
            
            if len(users_batch) < limit:
                break
                
            offset += limit
        
        print(f"[Clerk Sync Job] Fetched {len(all_clerk_users)} users from Clerk")
        
        # Get all clerk_user_ids from Clerk
        clerk_user_ids = set()
        created_count = 0
        updated_count = 0
        
        for clerk_user in all_clerk_users:
            user_id = clerk_user.get("id")
            if not user_id:
                continue
                
            clerk_user_ids.add(user_id)
            
            # Extract user information
            email_addresses = clerk_user.get("email_addresses", [])
            primary_email = None
            
            # Find primary email
            for email_obj in email_addresses:
                if email_obj.get("id") == clerk_user.get("primary_email_address_id"):
                    primary_email = email_obj.get("email_address")
                    break
            
            # Fallback to first email if primary not found
            if not primary_email and email_addresses:
                primary_email = email_addresses[0].get("email_address")
            
            # Skip if no email found
            if not primary_email:
                print(f"[Clerk Sync Job] Warning: No email found for user {user_id}, skipping")
                continue
            
            first_name = clerk_user.get("first_name")
            last_name = clerk_user.get("last_name")
            
            # Check if user exists in database by clerk_user_id
            existing_user = db.query(User).filter(User.clerk_user_id == user_id).first()
            
            if existing_user:
                # Update existing user
                existing_user.email = primary_email
                existing_user.first_name = first_name
                existing_user.last_name = last_name
                existing_user.is_active = True
                existing_user.deleted_account = False
                updated_count += 1
            else:
                # Check if email already exists with a different clerk_user_id
                existing_email_user = db.query(User).filter(User.email == primary_email).first()
                
                if existing_email_user:
                    # Update the existing record with the new clerk_user_id
                    print(f"[Clerk Sync Job] Email {primary_email} exists with different clerk_user_id. "
                          f"Updating from {existing_email_user.clerk_user_id} to {user_id}")
                    existing_email_user.clerk_user_id = user_id
                    existing_email_user.first_name = first_name
                    existing_email_user.last_name = last_name
                    existing_email_user.is_active = True
                    existing_email_user.deleted_account = False
                    updated_count += 1
                else:
                    # Create new user
                    new_user = User(
                        clerk_user_id=user_id,
                        email=primary_email,
                        first_name=first_name,
                        last_name=last_name,
                        is_active=True,
                        deleted_account=False
                    )
                    db.add(new_user)
                    created_count += 1
        
        # Mark users as deleted if they exist in DB but not in Clerk
        db_users = db.query(User).all()
        deleted_count = 0
        
        for db_user in db_users:
            if db_user.clerk_user_id not in clerk_user_ids:
                db_user.deleted_account = True
                db_user.is_active = False
                deleted_count += 1
        
        # Commit all changes
        db.commit()
        
        print(f"[Clerk Sync Job] Sync completed - Created: {created_count}, Updated: {updated_count}, Marked as deleted: {deleted_count}")
        
    except requests.exceptions.RequestException as e:
        db.rollback()
        print(f"[Clerk Sync Job] Error communicating with Clerk API: {str(e)}")
    
    except Exception as e:
        db.rollback()
        print(f"[Clerk Sync Job] Error syncing users: {str(e)}")
    
    finally:
        db.close()



# Send weekly research digest every Monday at 8:00 AM UTC
def send_weekly_digest_job():
    """Scheduled job: send the weekly digest to all subscribed users.
    
    Emails are sent at a rate of 1 per minute to avoid triggering spam filters.
    """
    import time

    try:
        from routers.mail_digests import _send_digest_to_user, _get_relevant_unread_articles
        import user_models as um

        _db = next(get_local_db())
        try:
            users = _db.query(um.User).filter(
                um.User.email_digest_subscribed == True,
                um.User.is_active == True,
                um.User.deleted_account == False,
            ).all()

            print(f"[WeeklyDigest] Starting – {len(users)} subscriber(s), sending 1 email/5 seconds to avoid spam filters...")
            sent = skipped = errors = 0
            for user in users:
                try:
                    ok = _send_digest_to_user(user, _db)
                    if ok:
                        sent += 1
                        print(f"[WeeklyDigest] Sent to {user.email} ({sent}/{len(users)}). Waiting 5 s...")
                        time.sleep(5)
                    else:
                        skipped += 1
                except Exception as exc:
                    errors += 1
                    print(f"[WeeklyDigest] Error sending to {user.email}: {exc}")

            print(f"[WeeklyDigest] Done – sent:{sent} skipped:{skipped} errors:{errors}")
        finally:
            _db.close()
    except Exception as e:
        print(f"[WeeklyDigest] Fatal error: {e}")
        
        
# Clear FAISS in-memory index cache AND DB-level results cache every 2 hours
# so rebuilt indexes are picked up automatically
def clear_faiss_index_cache_job():
    """
    Scheduled job to clear BOTH FAISS cache layers every 2 hours:
      1. In-process FAISS index cache  → forces reload from disk
      2. Per-user DB-level results cache → forces recomputation on next request
    Without clearing BOTH layers, users keep seeing stale article lists
    from the DB cache even after the in-memory index is refreshed.
    """
    # 1. Clear in-memory FAISS index cache
    stats_before = get_cache_stats()
    print(f"[FAISS Cache Job] Clearing {stats_before['count']} cached index(es): {stats_before['cached_indices']}")
    clear_faiss_cache()
    print("[FAISS Cache Job] In-memory FAISS index cache cleared.")
    clear_bm25_cache()  # pick up a rebuilt BM25 index (mmapped, cheap to reopen)

    # 2. Invalidate per-user DB-level FAISS results cache (main feed + bioarchive)
    db = None
    try:
        db = next(get_local_db())
        updated_rows = (
            db.query(models.Feeds)
            .filter(
                models.Feeds.faiss_results_cache.isnot(None)
                | models.Feeds.faiss_bioarchive_results_cache.isnot(None)
            )
            .update(
                {
                    models.Feeds.faiss_results_cache: None,
                    models.Feeds.faiss_cache_date_created: None,
                    models.Feeds.faiss_bioarchive_results_cache: None,
                    models.Feeds.faiss_bioarchive_cache_date_created: None,
                },
                synchronize_session=False,
            )
        )
        db.commit()
        print(f"[FAISS Cache Job] Invalidated {updated_rows} user DB-level FAISS cache(s) (main feed + bioarchive).")
    except Exception as e:
        if db:
            db.rollback()
        print(f"[FAISS Cache Job] Error invalidating DB cache: {e}")
    finally:
        if db:
            db.close()

    print("[FAISS Cache Job] Done. Next request will reload index from disk and recompute results.")



# Update user embeddings cache at 4:00 AM daily
scheduler.add_job(func=with_advisory_lock(900001)(wrapper_update_user_embeddings_cache), trigger='cron', hour=4, minute=0)

# Extract MeSH terms from new articles at 3:00 AM daily
scheduler.add_job(func=with_advisory_lock(900002)(extract_mesh_terms_job), trigger='cron', hour=3, minute=0)

# Sync Clerk users with database
scheduler.add_job(func=with_advisory_lock(900003)(sync_clerk_users_job), trigger='interval', minutes=30)

# Send weekly research digest every Monday at 8:00 AM UTC
scheduler.add_job(func=with_advisory_lock(900004)(send_weekly_digest_job), trigger='cron', day_of_week='mon', hour=8, minute=0)

# Clear FAISS in-memory index cache — runs in EVERY worker (each has its own cache)
scheduler.add_job(func=clear_faiss_index_cache_job, trigger='interval', hours=2)



