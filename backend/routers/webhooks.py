"""
Clerk webhook handlers.

Clerk delivers signed events via Svix.  Set the CLERK_WEBHOOK_SECRET
environment variable to the signing secret shown in the Clerk dashboard
(Webhooks → your endpoint → Signing Secret).

Handled events
--------------
user.created  → immediately upsert the new user into the local DB
user.updated  → update existing user record
user.deleted  → mark user as deleted / inactive
"""

import os
from fastapi import APIRouter, HTTPException, Request
from sqlalchemy.orm import Session
from database import get_local_db
from user_models import User

router = APIRouter(
    prefix="/webhooks",
    tags=["webhooks"],
)


def _upsert_clerk_user(clerk_user: dict, db: Session) -> str:
    """
    Insert or update a single Clerk user in the local database.
    Returns a short status string: 'created', 'updated', or 'skipped'.
    """
    user_id = clerk_user.get("id")
    if not user_id:
        return "skipped"

    email_addresses = clerk_user.get("email_addresses", [])
    primary_email = None

    for email_obj in email_addresses:
        if email_obj.get("id") == clerk_user.get("primary_email_address_id"):
            primary_email = email_obj.get("email_address")
            break

    if not primary_email and email_addresses:
        primary_email = email_addresses[0].get("email_address")

    if not primary_email:
        print(f"[ClerkWebhook] No email for user {user_id} — skipping")
        return "skipped"

    first_name = clerk_user.get("first_name")
    last_name = clerk_user.get("last_name")

    existing = db.query(User).filter(User.clerk_user_id == user_id).first()
    if existing:
        existing.email = primary_email
        existing.first_name = first_name
        existing.last_name = last_name
        existing.is_active = True
        existing.deleted_account = False
        db.commit()
        return "updated"

    # Guard against duplicate email with a different clerk_user_id
    by_email = db.query(User).filter(User.email == primary_email).first()
    if by_email:
        print(
            f"[ClerkWebhook] Email {primary_email} already exists "
            f"(clerk_id={by_email.clerk_user_id}). Updating to {user_id}."
        )
        by_email.clerk_user_id = user_id
        by_email.first_name = first_name
        by_email.last_name = last_name
        by_email.is_active = True
        by_email.deleted_account = False
        db.commit()
        return "updated"

    new_user = User(
        clerk_user_id=user_id,
        email=primary_email,
        first_name=first_name,
        last_name=last_name,
        is_active=True,
        deleted_account=False,
    )
    db.add(new_user)
    db.commit()
    return "created"


@router.post("/clerk", status_code=200)
async def clerk_webhook(request: Request):
    """
    Receive and handle Clerk webhook events.

    Signature verification is performed with the svix library when
    CLERK_WEBHOOK_SECRET is set.  If the secret is not configured the
    endpoint still works but logs a warning — suitable for local dev.
    """
    webhook_secret = os.getenv("CLERK_WEBHOOK_SECRET")

    payload_bytes = await request.body()

    # ── Signature verification ──────────────────────────────────────────
    if webhook_secret:
        try:
            from svix.webhooks import Webhook, WebhookVerificationError

            wh = Webhook(webhook_secret)
            # svix expects the raw headers as a plain dict[str, str]
            headers = dict(request.headers)
            try:
                event = wh.verify(payload_bytes, headers)
            except WebhookVerificationError:
                raise HTTPException(status_code=400, detail="Invalid webhook signature")
        except ImportError:
            print(
                "[ClerkWebhook] WARNING: svix package not installed. "
                "Signature verification skipped. Run: pip install svix"
            )
            import json
            event = json.loads(payload_bytes)
    else:
        print(
            "[ClerkWebhook] WARNING: CLERK_WEBHOOK_SECRET not set. "
            "Signature verification skipped."
        )
        import json
        event = json.loads(payload_bytes)

    event_type = event.get("type")
    data = event.get("data", {})

    print(f"[ClerkWebhook] Received event: {event_type}")

    db = next(get_local_db())
    try:
        if event_type == "user.created":
            status = _upsert_clerk_user(data, db)
            print(f"[ClerkWebhook] user.created → {status} (clerk_id={data.get('id')})")

        elif event_type == "user.updated":
            status = _upsert_clerk_user(data, db)
            print(f"[ClerkWebhook] user.updated → {status} (clerk_id={data.get('id')})")

        elif event_type == "user.deleted":
            clerk_user_id = data.get("id")
            if clerk_user_id:
                user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
                if user:
                    user.deleted_account = True
                    user.is_active = False
                    db.commit()
                    print(f"[ClerkWebhook] user.deleted → marked inactive (clerk_id={clerk_user_id})")
                else:
                    print(f"[ClerkWebhook] user.deleted → user not found locally (clerk_id={clerk_user_id})")

        else:
            print(f"[ClerkWebhook] Unhandled event type: {event_type}")

    except Exception as exc:
        db.rollback()
        print(f"[ClerkWebhook] Error processing {event_type}: {exc}")
        raise HTTPException(status_code=500, detail="Internal error processing webhook")
    finally:
        db.close()

    return {"status": "ok"}
