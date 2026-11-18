from sqlalchemy import JSON, BigInteger, Boolean, Column, DateTime, Float, String, Text, func, Integer
from sqlalchemy.dialects.postgresql import JSONB
from pgvector.sqlalchemy import Vector
from database import Base
from datetime import timedelta
from fnc import *

CURRENT_DATE = func.now() + timedelta(hours=get_GMT())


class Feeds(Base):
    __tablename__ = "feeds"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, primary_key=True, index=True)
    main_feed_embeddings = Column(Vector(768), default=None)
    main_feed_tags = Column(JSONB, default=None)
    main_feed_date_created = Column(DateTime, default=None)
    faiss_results_cache = Column(JSONB, default=None)
    faiss_cache_date_created = Column(DateTime, default=None)
    faiss_bioarchive_results_cache = Column(JSONB, default=None)
    faiss_bioarchive_cache_date_created = Column(DateTime, default=None)
    upvote_based_recommendations = Column(Boolean, default=True, server_default="true")
    embeddings_last_recomputed = Column(DateTime, default=None)
    interest_prompts_history = Column(JSONB, default=None)
    feeds = Column(JSONB, default=None)
    bookmarks = Column(JSONB, default=None)
    saved_bookmarks = Column(JSONB, default=None)
    

class Topics(Base):
    __tablename__ = "topics"

    id = Column(Integer, primary_key=True, autoincrement=True)
    broadtopic = Column(String, index=True, default=None)
    subtopic = Column(String, index=True, default=None)
    embeddings = Column(Vector(768), default=None)


class TrackedJournal(Base):
    __tablename__ = "tracked_journals"

    id = Column(Integer, primary_key=True)
    journal_title = Column(String, nullable=False)
    issn = Column(String, default=None)
    eissn = Column(String, default=None)
    wos_impact_factor = Column(Float, default=None)
    is_active_by_user = Column(Boolean, default=False)


class JournalIcon(Base):
    """Stores favicon / logo URLs for journals, resolved via DOI redirects."""
    __tablename__ = "journal_icons"

    id = Column(Integer, primary_key=True, autoincrement=True)
    journal_name = Column(String, unique=True, index=True, nullable=False)
    icon_url = Column(String, default=None)          # full URL to the favicon / logo
    source_domain = Column(String, default=None)      # e.g. "www.nature.com"
    resolved_from_doi = Column(String, default=None)  # the DOI used to discover the domain
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)


class Settings(Base):
    __tablename__ = "settings"
    
    id = Column(Integer, primary_key=True)
    setting_key = Column(String, unique=True, nullable=False)
    setting_value = Column(String, default=None)
    description = Column(String, default=None)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)
    

class TopicPageEmbedding(Base):
    __tablename__ = "topic_page_embeddings"

    slug = Column(String, primary_key=True)
    embeddings = Column(Vector(768), default=None)
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)


class Articles(Base):
    __tablename__ = "articles"

    id = Column(Integer, primary_key=True)
    issn = Column(String, default=None)
    publication_type = Column(String, default=None)
    title = Column(String, default=None)
    abstract = Column(Text, default=None)
    journal = Column(String, default=None)
    publication_date = Column(DateTime, default=CURRENT_DATE)
    authors_full = Column(Text, default=None)
    affiliations = Column(Text, default=None)
    doi = Column(String, default=None)
    pmcid = Column(String, default=None)
    pmid = Column(String, index=True, default=None)
    mesh_terms = Column(Text, default=None)
    substances = Column(Text, default=None)
    similar_articles = Column(Text, default=None)
    is_free = Column(Boolean, default=None)
    figures_urls = Column(Text, default=None)

    # Automated dates
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)
    
    # Open access indicators
    unpaywall_status = Column(String, default=None)
    is_open_access_unpaywall = Column(Boolean, default=None)
    is_open_access_science_direct_status = Column(String, default=None)
    is_open_access_science_direct = Column(Boolean, default=None)

    # SemanticScholar API data
    is_open_access_semanticscholar = Column(Boolean, default=None)
    licence_semanticscholar = Column(String, default=None)
    publication_type_semanticscholar = Column(String, default=None)

    # Europe PMC data
    is_open_access_europepmc = Column(Boolean, default=None)
    licence_europepmc = Column(String, default=None)
    europepmc_link1 = Column(Text, default=None)
    europepmc_link2 = Column(Text, default=None)

    # Paths to stored graphical abstracts
    graphical_abstract_path = Column(String, default=None)
    
    embeddings_biobert = Column(Vector(768), default=None)
    
    upvotes = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    
    

class ScimagojrRankings(Base):
    __tablename__ = "scimagojr_rankings"

    rank = Column(Integer, primary_key=True)
    source_id = Column(BigInteger)
    title = Column(String)
    publication_type = Column(String)
    issn = Column(String, default=None)
    sjr = Column(Float)
    sjr_best_quartile = Column(String)
    h_index = Column(Integer)
    total_docs_current_year = Column(Integer)
    total_docs_3years = Column(Integer)
    total_refs = Column(Integer)
    total_cites_3years = Column(Integer)
    citable_docs_3years = Column(Float)
    cites_per_doc_2years = Column(Float)
    ref_per_doc = Column(Float)
    percent_female = Column(Float)
    overton = Column(Float)
    sdg = Column(Float)
    country = Column(String)
    region = Column(String)
    publisher = Column(String)
    coverage = Column(String)
    categories = Column(String)
    areas = Column(String)
    open_access = Column(String)
    open_access = Column(String)
    open_access_diamond = Column(String)
    issn_print = Column(String, default=None)
    issn_electronic = Column(String, default=None)
    
    
class WosJournalsClarivateRankings(Base):
    __tablename__ = "wos_journals_clarivate_rankings"

    id = Column(Integer, primary_key=True)
    abbreviation = Column(String)
    issn = Column(String, index=True, default=None)
    eissn = Column(String, index=True, default=None)
    category = Column(String, default=None)
    wos_core_citation_indexes = Column(String, default=None)
    journal_impact_factor = Column(Float, default=None)
    five_year_impact_factor = Column(Float, default=None)
    best_ranking = Column(String, default=None)
    open_access_support = Column(String, default=None)
    country = Column(String, default=None)
    status_in_wos_core = Column(String, default=None)
    publisher = Column(String, default=None)
    
    
    
class UserUpvotes(Base):
    __tablename__ = "user_upvotes"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    article_id = Column(Integer, nullable=False)
    upvoted_at = Column(DateTime, default=CURRENT_DATE)


class Comment(Base):
    __tablename__ = "comments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    article_id = Column(Integer, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=CURRENT_DATE)


class UserArticleClicks(Base):
    __tablename__ = "user_article_clicks"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    article_id = Column(Integer, nullable=False)
    clicked_at = Column(DateTime, default=CURRENT_DATE)
    

class Notifications(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    notification_type = Column(String, default=None)       # e.g. "group_invite"
    notification_metadata = Column(JSONB, default=None)    # e.g. {group_key, group_name, group_icon}
    created_at = Column(DateTime, default=CURRENT_DATE)
    
    
class LogRoutes(Base):
    __tablename__ = "log_routes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String)
    datetime = Column(DateTime, default=CURRENT_DATE)
    requested_route = Column(String)
    requested_params = Column(String)
    requested_params_data = Column(String)


class SecurityAlert(Base):
    __tablename__ = "security_alerts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ip_address = Column(String, index=True)
    request_path = Column(String)
    alert_type = Column(String, index=True)  # ATTACK_PATTERN, RATE_LIMIT, BLOCKED_IP, IP_BLOCKED
    details = Column(Text)
    created_at = Column(DateTime, default=CURRENT_DATE)


class Testimonial(Base):
    __tablename__ = "testimonials"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, index=True, nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5 stars
    testimonial_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)


class JournalSuggestion(Base):
    __tablename__ = "journal_suggestions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, index=True, nullable=False)
    journal_name_or_issn = Column(String, nullable=False)
    created_at = Column(DateTime, default=CURRENT_DATE)


class DigestSentArticle(Base):
    """Tracks which articles have already been emailed to each user,
    so the same article is never included in a future digest."""
    __tablename__ = "digest_sent_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, index=True, nullable=False)
    article_id = Column(Integer, nullable=False)
    sent_at = Column(DateTime, default=CURRENT_DATE)
    
    
class ArticlesBioArchive(Base):
    __tablename__ = "articles_bioarchive"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, default=None)
    authors = Column(Text, default=None)
    author_corresponding = Column(String, default=None)
    author_corresponding_institution = Column(String, default=None)
    doi = Column(String, default=None)
    date_posted = Column(DateTime, default=None)
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)
    version = Column(Integer, default=1)
    publication_type = Column(String, default=None)
    license = Column(String, default=None)
    category = Column(String, default=None)
    abstract = Column(Text, default=None)
    published = Column(String, default=None)
    server = Column(String, default=None)
    embeddings_biobert = Column(Vector(768), default=None)
    upvotes = Column(Integer, default=0)


class UserBioArchiveUpvotes(Base):
    __tablename__ = "user_bioarchive_upvotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    article_id = Column(Integer, nullable=False, index=True)
    upvoted_at = Column(DateTime, default=CURRENT_DATE)


class UserBioArchiveClicks(Base):
    __tablename__ = "user_bioarchive_clicks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String, nullable=False, index=True)
    article_id = Column(Integer, nullable=False, index=True)
    clicked_at = Column(DateTime, default=CURRENT_DATE)


class FeatureAnnouncement(Base):
    """Admin-created feature announcements shown to users via a modal."""
    __tablename__ = "feature_announcements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String, nullable=False)
    bullets = Column(JSONB, nullable=False)  # list of strings
    created_at = Column(DateTime, default=CURRENT_DATE)
    is_active = Column(Boolean, default=True)


class FeatureAnnouncementSeen(Base):
    """Tracks which announcements each user has dismissed."""
    __tablename__ = "feature_announcement_seen"

    id = Column(Integer, primary_key=True, autoincrement=True)
    clerk_user_id = Column(String, nullable=False, index=True)
    announcement_id = Column(Integer, nullable=False, index=True)
    seen_at = Column(DateTime, default=CURRENT_DATE)


class Group(Base):
    """User-created groups where members can share articles with each other."""
    __tablename__ = "groups"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    icon = Column(String, default="👥")
    admin_user_id = Column(String, index=True, nullable=False)  # Clerk user ID
    # members: list of {user_id, email, status: "invited" | "active", role: "member" | "admin"}
    members = Column(JSONB, default=None)
    notifications_muted = Column(JSONB, default=list)  # list of user_ids who muted notifications
    is_public = Column(Boolean, default=False, nullable=False, server_default="false")
    tags = Column(JSONB, default=list)
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)


class GroupSharedArticle(Base):
    """Articles shared inside a group."""
    __tablename__ = "group_shared_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_key = Column(String, index=True, nullable=False)
    article_id = Column(Integer, nullable=False)
    shared_by_user_id = Column(String, nullable=False)
    shared_by_name = Column(String, nullable=True)
    shared_at = Column(DateTime, default=CURRENT_DATE)


class GroupComment(Base):
    """Comments posted in a group's discussion section."""
    __tablename__ = "group_comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    group_key = Column(String, index=True, nullable=False)
    user_id = Column(String, nullable=False)
    first_name = Column(String, default="")
    last_name = Column(String, default="")
    comment_text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=CURRENT_DATE)
    updated_at = Column(DateTime, default=CURRENT_DATE, onupdate=CURRENT_DATE)