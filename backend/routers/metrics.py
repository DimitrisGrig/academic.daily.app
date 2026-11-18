import os
from fastapi import APIRouter, Depends, HTTPException
from auth import get_current_user
import models
from sqlalchemy.orm import Session
from database import get_local_db
from sqlalchemy import func, cast, Date
from datetime import datetime, timedelta
import user_models

ADMIN_CLERK_USER_ID = os.getenv("ADMIN_CLERK_USER_ID")

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("/database-stats")
def get_database_statistics(current_user: dict = Depends(get_current_user), db: Session = Depends(get_local_db)):
    """
    Get comprehensive statistics about the entire database content.
    """
    
    # Articles Statistics
    total_articles = db.query(func.count(models.Articles.id)).scalar() or 0
    
    # Last database update (latest article created_at)
    last_update = db.query(func.max(models.Articles.created_at)).scalar()
    
    # Articles by publication date ranges
    thirty_days_ago = datetime.now() - timedelta(days=30)
    ninety_days_ago = datetime.now() - timedelta(days=90)
    one_year_ago = datetime.now() - timedelta(days=365)
    
    articles_last_30_days = db.query(func.count(models.Articles.id)).filter(
        models.Articles.publication_date >= thirty_days_ago
    ).scalar() or 0
    
    articles_last_90_days = db.query(func.count(models.Articles.id)).filter(
        models.Articles.publication_date >= ninety_days_ago
    ).scalar() or 0
    
    articles_last_year = db.query(func.count(models.Articles.id)).filter(
        models.Articles.publication_date >= one_year_ago
    ).scalar() or 0
    
    # Open access articles
    open_access_articles = db.query(func.count(models.Articles.id)).filter(
        models.Articles.is_open_access_unpaywall == True
    ).scalar() or 0
    
    # Articles with graphical abstracts
    articles_with_graphical_abstract = db.query(func.count(models.Articles.id)).filter(
        models.Articles.graphical_abstract_path.isnot(None)
    ).scalar() or 0
    
    # Articles by publication type
    publication_types = db.query(
        models.Articles.publication_type,
        func.count(models.Articles.id).label('count')
    ).filter(
        models.Articles.publication_type.isnot(None)
    ).group_by(models.Articles.publication_type).all()
    
    pub_types_dict = {pub_type: count for pub_type, count in publication_types}
    
    # Journals Statistics
    total_journals = db.query(func.count(models.TrackedJournal.id)).scalar() or 0
    active_journals = db.query(func.count(models.TrackedJournal.id)).filter(
        models.TrackedJournal.is_active_by_user == True
    ).scalar() or 0
    
    # Average impact factor
    journals_with_if = db.query(models.TrackedJournal.wos_impact_factor).filter(
        models.TrackedJournal.wos_impact_factor.isnot(None)
    ).all()
    
    avg_impact_factor = sum(j[0] for j in journals_with_if) / len(journals_with_if) if journals_with_if else 0
    
    # High impact journals (IF >= 10)
    high_impact_journals = db.query(func.count(models.TrackedJournal.id)).filter(
        models.TrackedJournal.wos_impact_factor >= 10
    ).scalar() or 0
    
    # Mid impact journals (3 <= IF < 10)
    mid_impact_journals = db.query(func.count(models.TrackedJournal.id)).filter(
        models.TrackedJournal.wos_impact_factor >= 3,
        models.TrackedJournal.wos_impact_factor < 10
    ).scalar() or 0
    
    # Topics/Tags Statistics
    total_topics = db.query(func.count(models.Topics.id)).scalar() or 0
    unique_broad_topics = db.query(func.count(func.distinct(models.Topics.broadtopic))).scalar() or 0
    
    # User Activity Statistics
    total_users = db.query(func.count(user_models.User.clerk_user_id)).scalar() or 0
    
    # Total upvotes across all articles
    total_upvotes = db.query(func.count(models.UserUpvotes.id)).scalar() or 0
    
    # Total comments
    total_comments = db.query(func.count(models.Comment.id)).scalar() or 0
    
    # Total article clicks/reads
    total_article_reads = db.query(func.count(models.UserArticleClicks.id)).scalar() or 0
    
    # Active users (users who have read at least one article)
    active_users = db.query(func.count(func.distinct(models.UserArticleClicks.user_id))).scalar() or 0
    
    # Bookmark statistics - sum total bookmarked articles across all users
    # saved_bookmarks structure: {"folder_key": [article_id, ...], ...}
    all_saved_bookmarks = db.query(models.Feeds.saved_bookmarks).filter(
        models.Feeds.saved_bookmarks.isnot(None)
    ).all()
    total_bookmarks = sum(
        sum(len(v) for v in user_bm[0].values() if isinstance(v, list))
        for user_bm in all_saved_bookmarks
        if isinstance(user_bm[0], dict)
    )
    
    # Custom feeds - sum total custom feeds across all users
    # feeds structure: [{...feed_obj...}, ...]
    total_custom_feeds = db.query(
        func.coalesce(func.sum(func.jsonb_array_length(models.Feeds.feeds)), 0)
    ).filter(
        models.Feeds.feeds.isnot(None)
    ).scalar() or 0
    
    # Most upvoted articles (top 5)
    top_upvoted_articles = db.query(
        models.Articles.id,
        models.Articles.title,
        models.Articles.journal,
        func.count(models.UserUpvotes.id).label('upvote_count')
    ).join(
        models.UserUpvotes,
        models.Articles.id == models.UserUpvotes.article_id
    ).group_by(
        models.Articles.id,
        models.Articles.title,
        models.Articles.journal
    ).order_by(
        func.count(models.UserUpvotes.id).desc()
    ).limit(5).all()
    
    top_articles = [
        {
            "id": article_id,
            "title": title,
            "journal": journal,
            "upvotes": upvote_count
        }
        for article_id, title, journal, upvote_count in top_upvoted_articles
    ]
    
    # Most commented articles (top 5)
    top_commented_articles = db.query(
        models.Articles.id,
        models.Articles.title,
        models.Articles.journal,
        func.count(models.Comment.id).label('comment_count')
    ).join(
        models.Comment,
        models.Articles.id == models.Comment.article_id
    ).group_by(
        models.Articles.id,
        models.Articles.title,
        models.Articles.journal
    ).order_by(
        func.count(models.Comment.id).desc()
    ).limit(5).all()
    
    top_commented = [
        {
            "id": article_id,
            "title": title,
            "journal": journal,
            "comments": comment_count
        }
        for article_id, title, journal, comment_count in top_commented_articles
    ]
    
    # Daily activity for the last 30 days
    daily_reads = db.query(
        cast(models.UserArticleClicks.clicked_at, Date).label('date'),
        func.count(models.UserArticleClicks.id).label('count')
    ).filter(
        models.UserArticleClicks.clicked_at >= thirty_days_ago
    ).group_by(
        cast(models.UserArticleClicks.clicked_at, Date)
    ).all()
    
    daily_activity = {str(date): count for date, count in daily_reads}
    
    # Top journals by article count
    top_journals = db.query(
        models.Articles.journal,
        func.count(models.Articles.id).label('article_count')
    ).filter(
        models.Articles.journal.isnot(None)
    ).group_by(
        models.Articles.journal
    ).order_by(
        func.count(models.Articles.id).desc()
    ).limit(10).all()
    
    top_journals_list = [
        {"journal": journal, "article_count": count}
        for journal, count in top_journals
    ]
    
    return {
        "articles": {
            "total": total_articles,
            "last_30_days": articles_last_30_days,
            "last_90_days": articles_last_90_days,
            "last_year": articles_last_year,
            "open_access": open_access_articles,
            "open_access_percentage": round((open_access_articles / total_articles * 100) if total_articles > 0 else 0, 1),
            "with_graphical_abstract": articles_with_graphical_abstract,
            "publication_types": pub_types_dict,
            "last_update": last_update.isoformat() if last_update else None
        },
        "journals": {
            "total": total_journals,
            "active": active_journals,
            "average_impact_factor": round(avg_impact_factor, 2),
            "high_impact": high_impact_journals,
            "mid_impact": mid_impact_journals,
            "top_journals": top_journals_list
        },
        "topics": {
            "total_subtopics": total_topics,
            "total_broad_topics": unique_broad_topics
        },
        "users": {
            "total": total_users,
            "active": active_users,
            "engagement_rate": round((active_users / total_users * 100) if total_users > 0 else 0, 1)
        },
        "engagement": {
            "total_upvotes": total_upvotes,
            "total_comments": total_comments,
            "total_reads": total_article_reads,
            "total_bookmarks": total_bookmarks,
            "total_custom_feeds": total_custom_feeds,
            "top_upvoted_articles": top_articles,
            "top_commented_articles": top_commented,
            "daily_activity_last_30_days": daily_activity
        }
    }


@router.get("/feature-adoption")
def get_feature_adoption_stats(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db)
):
    """Admin-only: Feature adoption and user behaviour analytics mined from the feeds table."""
    if current_user.get("user_id") != ADMIN_CLERK_USER_ID:
        raise HTTPException(status_code=403, detail="Admin access required")

    # ── Totals ────────────────────────────────────────────────────────────────
    total_users = db.query(func.count(user_models.User.clerk_user_id)).scalar() or 0
    email_digest_subscribers = (
        db.query(func.count(user_models.User.clerk_user_id))
        .filter(user_models.User.email_digest_subscribed == True)
        .scalar() or 0
    )

    # ── Mine feeds rows in Python (small N; avoids complex JSONB SQL) ─────────
    all_feeds = db.query(models.Feeds).all()
    total_users_with_feeds = len(all_feeds)

    users_with_main_feed = 0
    users_with_custom_feeds = 0
    users_with_journal_follows = 0
    users_with_bookmarks = 0
    users_with_upvote_recs = 0
    users_with_interest_prompts = 0
    total_custom_feeds_n = 0
    total_journal_follows_n = 0
    total_bookmark_folders = 0
    total_bookmarks_n = 0
    cf_dist = {"0": 0, "1": 0, "2-3": 0, "4-10": 0, "10+": 0}

    for row in all_feeds:
        if row.main_feed_tags or row.main_feed_embeddings:
            users_with_main_feed += 1

        cf_count = 0
        jf_count = 0
        if row.feeds and isinstance(row.feeds, list):
            cf_count = sum(1 for f in row.feeds if f.get("feed_type", "custom_feed") != "journal_follow")
            jf_count = sum(1 for f in row.feeds if f.get("feed_type") == "journal_follow")
            if cf_count > 0:
                users_with_custom_feeds += 1
                total_custom_feeds_n += cf_count
            if jf_count > 0:
                users_with_journal_follows += 1
                total_journal_follows_n += jf_count

        if cf_count == 0:
            cf_dist["0"] += 1
        elif cf_count == 1:
            cf_dist["1"] += 1
        elif cf_count <= 3:
            cf_dist["2-3"] += 1
        elif cf_count <= 10:
            cf_dist["4-10"] += 1
        else:
            cf_dist["10+"] += 1

        if row.saved_bookmarks and isinstance(row.saved_bookmarks, dict):
            bm_n = sum(len(v) for v in row.saved_bookmarks.values() if isinstance(v, list))
            if bm_n > 0:
                users_with_bookmarks += 1
                total_bookmark_folders += len(row.saved_bookmarks)
                total_bookmarks_n += bm_n

        if row.upvote_based_recommendations:
            users_with_upvote_recs += 1

        if row.interest_prompts_history:
            users_with_interest_prompts += 1

    def pct(n: int, total: int) -> float:
        return round(n / total * 100, 1) if total > 0 else 0.0

    # ── User registration growth (last 12 weeks) ──────────────────────────────
    twelve_weeks_ago = datetime.now() - timedelta(weeks=12)
    growth_rows = (
        db.query(
            func.date_trunc("week", user_models.User.created_at).label("week"),
            func.count(user_models.User.clerk_user_id).label("count"),
        )
        .filter(user_models.User.created_at >= twelve_weeks_ago)
        .group_by(func.date_trunc("week", user_models.User.created_at))
        .order_by(func.date_trunc("week", user_models.User.created_at))
        .all()
    )
    user_growth = [{"week": str(w.date()), "count": c} for w, c in growth_rows]

    # ── Top clicked articles (last 30 days) ───────────────────────────────────
    thirty_days_ago = datetime.now() - timedelta(days=30)
    top_clicked_rows = (
        db.query(
            models.Articles.id,
            models.Articles.title,
            models.Articles.journal,
            func.count(models.UserArticleClicks.id).label("clicks"),
        )
        .join(models.UserArticleClicks, models.Articles.id == models.UserArticleClicks.article_id)
        .filter(models.UserArticleClicks.clicked_at >= thirty_days_ago)
        .group_by(models.Articles.id, models.Articles.title, models.Articles.journal)
        .order_by(func.count(models.UserArticleClicks.id).desc())
        .limit(10)
        .all()
    )
    top_clicked = [
        {"id": r[0], "title": r[1], "journal": r[2], "clicks": r[3]}
        for r in top_clicked_rows
    ]

    # ── BioArchive ────────────────────────────────────────────────────────────
    bioarchive_users = (
        db.query(func.count(func.distinct(models.UserBioArchiveClicks.user_id))).scalar() or 0
    )
    bioarchive_clicks = db.query(func.count(models.UserBioArchiveClicks.id)).scalar() or 0
    bioarchive_upvotes = db.query(func.count(models.UserBioArchiveUpvotes.id)).scalar() or 0

    # ── Groups ────────────────────────────────────────────────────────────────
    total_groups = db.query(func.count(models.Group.id)).scalar() or 0
    total_shared = db.query(func.count(models.GroupSharedArticle.id)).scalar() or 0

    # ── Popular routes (last 30 days) ─────────────────────────────────────────
    route_rows = (
        db.query(
            models.LogRoutes.requested_route,
            func.count(models.LogRoutes.id).label("requests"),
            func.count(func.distinct(models.LogRoutes.username)).label("unique_users"),
        )
        .filter(
            models.LogRoutes.datetime >= thirty_days_ago,
            models.LogRoutes.username != "anonymous",
            models.LogRoutes.username.isnot(None),
            models.LogRoutes.username != "",
        )
        .group_by(models.LogRoutes.requested_route)
        .order_by(func.count(models.LogRoutes.id).desc())
        .limit(15)
        .all()
    )
    popular_routes = [
        {"route": r[0], "requests": r[1], "unique_users": r[2]}
        for r in route_rows
    ]

    return {
        "total_users": total_users,
        "total_users_with_feeds": total_users_with_feeds,
        "feature_adoption": {
            "main_feed": {
                "users": users_with_main_feed,
                "percentage": pct(users_with_main_feed, total_users),
            },
            "custom_feeds": {
                "users": users_with_custom_feeds,
                "percentage": pct(users_with_custom_feeds, total_users),
                "avg_per_user": round(total_custom_feeds_n / users_with_custom_feeds, 1) if users_with_custom_feeds else 0,
                "distribution": cf_dist,
            },
            "journal_follows": {
                "users": users_with_journal_follows,
                "percentage": pct(users_with_journal_follows, total_users),
                "avg_per_user": round(total_journal_follows_n / users_with_journal_follows, 1) if users_with_journal_follows else 0,
            },
            "bookmarks": {
                "users": users_with_bookmarks,
                "percentage": pct(users_with_bookmarks, total_users),
                "avg_folders": round(total_bookmark_folders / users_with_bookmarks, 1) if users_with_bookmarks else 0,
                "avg_bookmarks": round(total_bookmarks_n / users_with_bookmarks, 1) if users_with_bookmarks else 0,
            },
            "upvote_recommendations": {
                "enabled": users_with_upvote_recs,
                "disabled": total_users_with_feeds - users_with_upvote_recs,
                "percentage_enabled": pct(users_with_upvote_recs, total_users_with_feeds),
            },
            "interest_prompts": {
                "users": users_with_interest_prompts,
                "percentage": pct(users_with_interest_prompts, total_users),
            },
            "email_digest": {
                "subscribers": email_digest_subscribers,
                "percentage": pct(email_digest_subscribers, total_users),
            },
            "bioarchive": {
                "users": bioarchive_users,
                "percentage": pct(bioarchive_users, total_users),
            },
        },
        "user_growth_last_12_weeks": user_growth,
        "top_clicked_articles_last_30_days": top_clicked,
        "bioarchive": {
            "unique_users": bioarchive_users,
            "total_clicks": bioarchive_clicks,
            "upvotes": bioarchive_upvotes,
            "percentage_of_users": pct(bioarchive_users, total_users),
        },
        "groups": {
            "total": total_groups,
            "total_shared_articles": total_shared,
        },
        "popular_routes_last_30_days": popular_routes,
    }


@router.get("/user-return-visits")
def get_user_return_visits(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_local_db),
):
    """
    Admin-only: Distribution of how many distinct days each user returned to the
    app after their very first session.  One calendar day = one visit regardless
    of how many requests were made that day.
    """
    if current_user.get("user_id") != ADMIN_CLERK_USER_ID:
        raise HTTPException(status_code=403, detail="Admin access required")

    # Distinct visit-days per username (email or clerk-user-id)
    visit_rows = (
        db.query(
            models.LogRoutes.username,
            func.count(func.distinct(cast(models.LogRoutes.datetime, Date))).label("visit_days"),
        )
        .filter(
            models.LogRoutes.username.isnot(None),
            models.LogRoutes.username != "",
            models.LogRoutes.username != "anonymous",
            models.LogRoutes.username != ADMIN_CLERK_USER_ID,
        )
        .group_by(models.LogRoutes.username)
        .all()
    )
    username_to_days: dict[str, int] = {row.username: row.visit_days for row in visit_rows}

    # All non-deleted users (excluding admin)
    all_users = (
        db.query(user_models.User)
        .filter(
            user_models.User.deleted_account == False,
            user_models.User.clerk_user_id != ADMIN_CLERK_USER_ID,
        )
        .all()
    )

    # Match each user to their visit-day count via clerk_user_id OR email
    return_visit_counts: list[int] = []
    for u in all_users:
        days = max(
            username_to_days.get(u.clerk_user_id, 0),
            username_to_days.get(u.email, 0),
        )
        # Subtract 1 so "0" means "never came back after the first session"
        return_visit_counts.append(max(0, days - 1))

    # Build ordered distribution buckets
    bucket_order = ["0", "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "50+"]
    buckets: dict[str, int] = {k: 0 for k in bucket_order}

    for rv in return_visit_counts:
        if rv == 0:
            buckets["0"] += 1
        elif rv == 1:
            buckets["1"] += 1
        elif rv == 2:
            buckets["2"] += 1
        elif rv == 3:
            buckets["3"] += 1
        elif rv == 4:
            buckets["4"] += 1
        elif rv == 5:
            buckets["5"] += 1
        elif rv <= 10:
            buckets["6-10"] += 1
        elif rv <= 20:
            buckets["11-20"] += 1
        elif rv <= 50:
            buckets["21-50"] += 1
        else:
            buckets["50+"] += 1

    total = len(return_visit_counts)
    never_returned = buckets["0"]
    returned = total - never_returned

    distribution = [{"label": k, "users": buckets[k]} for k in bucket_order]

    return {
        "distribution": distribution,
        "summary": {
            "total_users": total,
            "never_returned": never_returned,
            "returned_at_least_once": returned,
            "retention_rate": round(returned / total * 100, 1) if total else 0.0,
            "avg_return_visits": round(sum(return_visit_counts) / total, 1) if total else 0.0,
        },
    }
