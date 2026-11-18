"""
populate_journal_icons.py
─────────────────────────
Stand-alone script that populates the `journal_icons` table.

Strategy
--------
1. For every distinct journal name in `articles`, pick one random DOI.
2. Follow the DOI redirect (https://doi.org/<doi>) to the article landing page.
3. Parse the HTML for <link rel="icon"> / <link rel="shortcut icon"> /
   <link rel="apple-touch-icon"> tags to discover the *real* journal favicon
   (many publisher sites like Elsevier dynamically swap the favicon via JS
   after page load; the correct icon is usually declared in the HTML <link> tags).
4. Fall back to /favicon.ico → Google Favicon API if HTML parsing finds nothing.
5. Upsert (insert-or-update) the result into `journal_icons`.

Usage
-----
    python populate_journal_icons.py              # process all journals
    python populate_journal_icons.py --limit 50   # process first 50 only
    python populate_journal_icons.py --journal "Nature"  # process one journal
"""

import argparse
import re
import time
from html.parser import HTMLParser
from urllib.parse import unquote, urljoin, urlparse

import requests
from sqlalchemy import func, text
from sqlalchemy.dialects.postgresql import insert as pg_insert

from database import local_main
import models

# ── Config ──────────────────────────────────────────────────────────────────────
GOOGLE_FAVICON_API = "https://www.google.com/s2/favicons?sz=64&domain={domain}"
DOI_BASE = "https://doi.org/"
REQUEST_TIMEOUT = 10          # seconds
RATE_LIMIT_DELAY = 0.3        # pause between DOI lookups to be polite

# Icon <link> rel values we look for, in priority order (best → worst).
_ICON_RELS = {"apple-touch-icon", "apple-touch-icon-precomposed", "icon", "shortcut icon"}

# Preferred image types (SVG > PNG > anything else)
_TYPE_PRIORITY = {"image/svg+xml": 0, "image/png": 1}


# ── HTML <link> icon parser (stdlib only — no BeautifulSoup needed) ────────────
class _LinkIconParser(HTMLParser):
    """Lightweight HTML parser that extracts favicon <link> tags."""

    def __init__(self):
        super().__init__()
        self.icons: list[dict] = []  # [{href, rel, type, sizes}, …]
        self._in_head = False
        self._past_head = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]):
        tag = tag.lower()
        if tag == "head":
            self._in_head = True
            return
        if tag == "body" or (self._past_head and tag not in ("html", "head", "link", "meta", "title", "script", "style")):
            self._past_head = True

        if tag != "link":
            return

        attr_map = {k.lower(): (v or "").lower() for k, v in attrs}
        rel = attr_map.get("rel", "")

        # Check if this <link> has an icon-related rel
        if not any(icon_rel in rel for icon_rel in _ICON_RELS):
            return

        href = None
        for k, v in attrs:
            if k.lower() == "href":
                href = v  # keep original case
                break

        if href:
            self.icons.append({
                "href": href,
                "rel": rel,
                "type": attr_map.get("type", ""),
                "sizes": attr_map.get("sizes", ""),
            })

    def handle_endtag(self, tag: str):
        if tag.lower() == "head":
            self._in_head = False
            self._past_head = True


def _pick_best_icon(icons: list[dict]) -> str | None:
    """Choose the best icon from a list of parsed <link> entries.

    Preference order:
    1. apple-touch-icon (usually a high-quality PNG, journal-specific)
    2. SVG icons (resolution-independent)
    3. Largest PNG icon by declared size
    4. Any other icon
    """

    def _size_value(sizes_str: str) -> int:
        """Parse '32x32' or '180x180' → max dimension; 0 if missing."""
        m = re.search(r"(\d+)\s*[xX×]\s*(\d+)", sizes_str)
        return max(int(m.group(1)), int(m.group(2))) if m else 0

    def _sort_key(icon: dict) -> tuple:
        rel = icon["rel"]
        typ = icon["type"]
        size = _size_value(icon["sizes"])

        # Lower = better
        rel_score = 0 if "apple-touch-icon" in rel else 1
        type_score = _TYPE_PRIORITY.get(typ, 2)
        # Negate size so larger is sorted first
        return (rel_score, type_score, -size)

    icons_sorted = sorted(icons, key=_sort_key)
    return icons_sorted[0]["href"] if icons_sorted else None


def _extract_icons_from_html(html: str) -> list[dict]:
    """Parse HTML and return list of icon link entries."""
    parser = _LinkIconParser()
    try:
        parser.feed(html)
    except Exception:
        pass
    return parser.icons


def _follow_elsevier_redirect(html: str) -> str | None:
    """Parse Elsevier linkinghub's intermediate page to find the real journal URL.

    Elsevier's linkinghub.elsevier.com serves a JS/meta-refresh redirect page
    with the real journal URL buried in:
      - <meta HTTP-EQUIV="REFRESH" content="2; url='...Redirect=<REAL_URL>&...'"/>
      - <input type="hidden" name="redirectURL" value="<REAL_URL_ENCODED>"/>
    """
    # Method 1: hidden redirectURL field (most reliable)
    m = re.search(r'name=["\']redirectURL["\'][^>]*value=["\']([^"\']+)', html)
    if m:
        return unquote(m.group(1))

    # Method 2: meta-refresh Redirect= parameter
    m = re.search(r'REFRESH[^>]+Redirect=([^&"\'>]+)', html, re.I)
    if m:
        return unquote(m.group(1))

    return None


def resolve_domain_from_doi(doi: str) -> tuple[str | None, str | None, str | None]:
    """Follow the DOI redirect, GET the page, return (domain, final_url, html).

    Handles multi-stage redirects like Elsevier's linkinghub:
      doi.org → linkinghub.elsevier.com (meta-refresh) → thelancet.com / cell.com

    We use GET (not HEAD) so we can parse the HTML for <link> icon tags.
    Only the first 100 KB of the response is read to keep things fast.
    """
    try:
        resp = requests.get(
            DOI_BASE + doi,
            allow_redirects=True,
            timeout=REQUEST_TIMEOUT,
            headers={"User-Agent": "AcademicDaily/1.0 (journal-icon-fetcher)"},
            stream=True,
        )
        final_url = resp.url
        parsed = urlparse(final_url)
        domain = parsed.netloc

        # Read at most ~100 KB — enough for <head> content
        html_chunk = resp.content[:102_400].decode("utf-8", errors="replace")
        resp.close()

        # ── Handle Elsevier linkinghub intermediate pages ───────────────────
        if "linkinghub.elsevier.com" in domain:
            real_url = _follow_elsevier_redirect(html_chunk)
            if real_url:
                real_domain = urlparse(real_url).netloc
                if real_domain and real_domain != domain:
                    print(f"   🔗 Elsevier redirect: {domain} → {real_domain}")
                    domain = real_domain

                    # Try to GET the real journal page for icon parsing
                    try:
                        resp2 = requests.get(
                            real_url,
                            allow_redirects=True,
                            timeout=REQUEST_TIMEOUT,
                            headers={"User-Agent": "AcademicDaily/1.0 (journal-icon-fetcher)"},
                            stream=True,
                        )
                        final_url = resp2.url
                        html_chunk = resp2.content[:102_400].decode("utf-8", errors="replace")
                        resp2.close()

                        # If we hit a Cloudflare challenge ("Just a moment...")
                        # the HTML is useless — set to None so we fall through
                        if "Just a moment" in html_chunk[:500]:
                            print(f"   ⚡ Cloudflare detected on {real_domain}, using Google Favicon API")
                            html_chunk = None
                    except Exception:
                        html_chunk = None  # couldn't reach real site, that's OK

        return domain, final_url, html_chunk
    except Exception as exc:
        print(f"  ⚠  DOI resolve failed for {doi}: {exc}")
        return None, None, None


def build_icon_url(domain: str, page_url: str | None = None, html: str | None = None) -> str:
    """Return the best favicon URL for a journal.

    1. Parse the landing-page HTML for <link rel="icon"> tags (catches
       journal-specific favicons that publishers like Elsevier set via JS).
    2. Fall back to /favicon.ico at the domain root.
    3. Final fallback: Google's public favicon API (works even behind Cloudflare).
    """

    # ── Step 1: Extract icon from HTML <link> tags ──────────────────────────
    if html:
        icons = _extract_icons_from_html(html)
        best_href = _pick_best_icon(icons)
        if best_href:
            # Resolve relative URLs against the page URL
            base = page_url or f"https://{domain}/"
            absolute_url = urljoin(base, best_href)

            # Quick HEAD check to ensure the URL is reachable
            try:
                check = requests.head(absolute_url, timeout=5, allow_redirects=True,
                                      headers={"User-Agent": "AcademicDaily/1.0"})
                if check.status_code == 200:
                    print(f"   📄 Found icon in HTML <link>: {absolute_url}")
                    return absolute_url
            except Exception:
                pass  # icon URL not reachable, continue to fallbacks

    # ── Step 2: Try /favicon.ico at domain root ─────────────────────────────
    try:
        direct = f"https://{domain}/favicon.ico"
        resp = requests.head(direct, timeout=5, allow_redirects=True,
                             headers={"User-Agent": "AcademicDaily/1.0"})
        if resp.status_code == 200 and "image" in resp.headers.get("content-type", ""):
            return direct
    except Exception:
        pass

    # ── Step 3: Google Favicon API fallback ─────────────────────────────────
    return GOOGLE_FAVICON_API.format(domain=domain)


def get_journals_with_doi(db, limit: int | None = None, journal_filter: str | None = None):
    """Return list of (journal_name, doi) by picking one random DOI per journal."""
    # Sub-query: distinct journal + one arbitrary DOI per journal
    query = (
        db.query(
            models.Articles.journal,
            func.min(models.Articles.doi).label("doi"),  # deterministic pick
        )
        .filter(
            models.Articles.journal.isnot(None),
            models.Articles.doi.isnot(None),
            models.Articles.journal != "",
            models.Articles.doi != "",
        )
        .group_by(models.Articles.journal)
        .order_by(models.Articles.journal)
    )

    if journal_filter:
        query = query.filter(func.lower(models.Articles.journal) == journal_filter.lower())

    if limit:
        query = query.limit(limit)

    return query.all()


def upsert_icon(db, journal_name: str, icon_url: str, source_domain: str, doi: str):
    """Insert or update a journal_icons row (Postgres upsert)."""
    stmt = pg_insert(models.JournalIcon).values(
        journal_name=journal_name,
        icon_url=icon_url,
        source_domain=source_domain,
        resolved_from_doi=doi,
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["journal_name"],
        set_={
            "icon_url": stmt.excluded.icon_url,
            "source_domain": stmt.excluded.source_domain,
            "resolved_from_doi": stmt.excluded.resolved_from_doi,
            "updated_at": func.now(),
        },
    )
    db.execute(stmt)
    db.commit()


def main():
    parser = argparse.ArgumentParser(description="Populate journal_icons table with favicons.")
    parser.add_argument("--limit", type=int, default=None, help="Max journals to process")
    parser.add_argument("--journal", type=str, default=None, help="Process a single journal by name")
    parser.add_argument("--skip-existing", action="store_true", help="Skip journals that already have an icon")
    args = parser.parse_args()

    db = local_main()

    try:
        # Ensure the table exists
        models.Base.metadata.create_all(bind=db.get_bind())

        journals = get_journals_with_doi(db, limit=args.limit, journal_filter=args.journal)
        print(f"📋 Found {len(journals)} journals to process")

        # Optionally load existing icons to skip
        existing = set()
        if args.skip_existing:
            existing = {
                row[0]
                for row in db.query(models.JournalIcon.journal_name).all()
            }
            print(f"   ({len(existing)} already have icons — will skip)")

        success, skipped, failed = 0, 0, 0

        for journal_name, doi in journals:
            if journal_name in existing:
                skipped += 1
                continue

            print(f"🔍 {journal_name}  (DOI: {doi})")

            domain, final_url, html = resolve_domain_from_doi(doi)
            if not domain:
                print(f"   ❌ Could not resolve domain")
                failed += 1
                time.sleep(RATE_LIMIT_DELAY)
                continue

            icon_url = build_icon_url(domain, page_url=final_url, html=html)
            print(f"   ✅ {domain} → {icon_url}")

            upsert_icon(db, journal_name, icon_url, domain, doi)
            success += 1
            time.sleep(RATE_LIMIT_DELAY)

        print(f"\n{'─' * 50}")
        print(f"✅ Done: {success} added/updated, {skipped} skipped, {failed} failed")

    finally:
        db.close()


if __name__ == "__main__":
    main()
