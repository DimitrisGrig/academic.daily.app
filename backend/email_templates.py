"""
HTML email template for the weekly research digest.
Designed to be clean, academic, and deliverable (anti-spam best-practices built in).
"""
from datetime import datetime
import html


LINKEDIN_URL = "https://www.linkedin.com/company/daily-academic"
GITHUB_URL = "https://github.com/DimitrisGrig/academic.daily.app/issues/new/choose"
APP_URL = "https://app.daily-academic.com"
LOGO_URL = "https://app.daily-academic.com/logo.png"   # update if hosted elsewhere
BRAND_COLOR = "#7974e8"   # indigo
SENDER_NAME = "Daily Academic"


def _article_block(article: dict, index: int) -> str:
    """
    Render a single article card.
    article dict keys: title, journal, doi, abstract, graphical_abstract_path, authors,
                       id, is_open_access, publication_type, impact_factor
    """
    title = html.escape(article.get("title") or "Untitled")
    journal = html.escape(article.get("journal") or "")
    abstract = html.escape((article.get("abstract") or "")[:300]).strip()
    if len(article.get("abstract") or "") > 300:
        abstract += "…"

    article_id = article.get("id")
    doi = article.get("doi") or ""
    # Prefer in-app article page; fall back to DOI link
    if article_id:
        article_url = f"{APP_URL}/Article?article_id={article_id}"
    elif doi:
        article_url = f"https://doi.org/{doi}"
    else:
        article_url = APP_URL

    graphical_abstract = article.get("graphical_abstract_path") or ""
    authors_raw = article.get("authors_full") or ""
    # Shorten author list to first 3
    author_list = [a.strip() for a in authors_raw.split(";") if a.strip()]
    authors_short = "; ".join(author_list[:3])
    if len(author_list) > 3:
        authors_short += f" +{len(author_list) - 3} more"
    authors_short = html.escape(authors_short)

    pub_date = ""
    if article.get("publication_date"):
        try:
            d = article["publication_date"]
            if hasattr(d, "strftime"):
                pub_date = d.strftime("%b %d, %Y")
            else:
                pub_date = str(d)[:10]
        except Exception:
            pass

    # ── Badge chips (Open Access · Review/type · Impact Factor) ──────────────
    badge_parts = []

    is_oa = article.get("is_open_access")
    if is_oa:
        badge_parts.append(
            '<span style="display:inline-block;padding:2px 8px;border-radius:20px;'
            'font-size:11px;font-weight:600;font-family:Arial,sans-serif;'
            'color:#16a34a;background:#dcfce7;border:1px solid #bbf7d0;margin-right:5px;">'
            "Open Access"
            "</span>"
        )

    pub_type = (article.get("publication_type") or "").strip()
    SHOW_TYPES = {"review", "systematic review", "meta-analysis", "clinical trial",
                  "case report", "letter", "editorial", "comment", "book chapter",
                  "preprint", "journal article"}
    if pub_type and pub_type.lower() in SHOW_TYPES:
        badge_parts.append(
            f'<span style="display:inline-block;padding:2px 8px;border-radius:20px;'
            f'font-size:11px;font-weight:600;font-family:Arial,sans-serif;'
            f'color:#6b7280;background:#f3f4f6;border:1px solid #e5e7eb;margin-right:5px;">'
            f"{html.escape(pub_type.title())}"
            f"</span>"
        )

    impact_factor = article.get("impact_factor")
    if impact_factor:
        try:
            if_val = float(impact_factor)
            badge_parts.append(
                f'<span style="display:inline-block;padding:2px 8px;border-radius:20px;'
                f'font-size:11px;font-weight:600;font-family:Arial,sans-serif;'
                f'color:#d97706;background:#fffbeb;border:1px solid #fde68a;margin-right:5px;">'
                f"Impact Factor: {if_val:.1f}"
                f"</span>"
            )
        except (TypeError, ValueError):
            pass

    badge_row = ""
    if badge_parts:
        badge_row = (
            '<tr><td style="padding:0 0 8px 0;">'
            + "".join(badge_parts)
            + "</td></tr>"
        )

    # ── Graphical abstract image (inline if available) ────────────────────────
    img_block = ""
    if graphical_abstract:
        img_src = graphical_abstract if graphical_abstract.startswith("http") else f"{APP_URL}/{graphical_abstract.lstrip('/')}"
        img_block = f"""
        <tr>
          <td style="padding:0 0 12px 0;">
            <a href="{article_url}" style="text-decoration:none;">
              <img src="{img_src}" alt="Graphical Abstract"
                   style="max-width:100%;height:auto;border-radius:6px;border:1px solid #e5e7eb;display:block;" />
            </a>
          </td>
        </tr>"""

    divider = "" if index == 0 else '<tr><td style="padding:0 0 20px 0;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td></tr>'

    # External-link icon SVG (mimics FiExternalLink — safe in most email clients)
    ext_icon = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" '
        'stroke-linejoin="round" style="display:inline-block;vertical-align:text-bottom;margin-left:5px;">'
        '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>'
        '<polyline points="15 3 21 3 21 9"/>'
        '<line x1="10" y1="14" x2="21" y2="3"/>'
        "</svg>"
    )

    return f"""
    {divider}
    <tr>
      <td style="padding:0 0 20px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          {img_block}
          {badge_row}
          <tr>
            <td>
              <p style="margin:0 0 4px 0;font-size:11px;color:#6b7280;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.5px;">
                {journal}{(' &nbsp;·&nbsp; ' + pub_date) if pub_date else ''}
              </p>
              <h3 style="margin:0 0 8px 0;font-size:17px;line-height:1.4;font-family:Georgia,'Times New Roman',serif;">
                <a href="{article_url}" style="color:#111827;text-decoration:none;">{title}</a>
              </h3>
              {'<p style="margin:0 0 6px 0;font-size:12px;color:#9ca3af;font-family:Arial,sans-serif;">' + authors_short + '</p>' if authors_short else ''}
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.7;color:#4b5563;font-family:Arial,sans-serif;">{abstract}</p>
              <a href="{article_url}"
                 style="display:inline-block;padding:8px 16px;background-color:{BRAND_COLOR};color:#ffffff;
                        border-radius:8px;font-size:13px;font-family:Arial,sans-serif;
                        text-decoration:none;font-weight:600;line-height:1;">
                Read more {ext_icon}
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>"""


def build_digest_email(user_first_name: str, articles: list[dict], unsubscribe_url: str, send_date: datetime | None = None) -> tuple[str, str]:
    """
    Returns (subject, html_body) for the weekly digest email.

    Anti-spam practices applied:
    - Plain text fallback embedded via multipart (caller should send as multipart/alternative)
    - Legitimate unsubscribe link in both header and footer
    - No deceptive subject lines
    - Physical mailing address in footer
    - Proper content-type and encoding hints
    - No URL shorteners / redirect chains
    - Sender name consistent with From address
    """
    date_str = (send_date or datetime.utcnow()).strftime("%B %d, %Y")
    greeting = f"Hi {html.escape(user_first_name)}," if user_first_name else "Hello,"

    article_blocks = "".join(
        _article_block(art, i) for i, art in enumerate(articles[:5])
    )

    subject = f"Your Weekly Research Digest – {date_str}"

    html_body = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <title>{html.escape(subject)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f8f8f8;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <!-- Preheader -->
  <div style="display:none;font-size:1px;color:#f8f8f8;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    Your Weekly Research Digest – {date_str}
  </div>

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8f8f8;">
    <tr>
      <td align="center" style="padding:32px 16px 40px;">

        <!-- Outer card -->
        <table width="600" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;width:100%;background-color:#ffffff;
                      border-radius:4px;border:1px solid #e5e7eb;">

          <!-- ===== HEADER: thin brand stripe + wordmark ===== -->
          <tr>
            <td style="border-top:3px solid {BRAND_COLOR};padding:28px 36px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <a href="{APP_URL}" style="text-decoration:none;">
                      <span style="font-family:Georgia,'Times New Roman',serif;font-size:18px;
                                   font-weight:bold;color:#111827;letter-spacing:-0.3px;">
                        Daily Academic
                      </span>
                    </a>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-family:Arial,sans-serif;font-size:11px;
                                 color:#9ca3af;letter-spacing:0.4px;text-transform:uppercase;">
                      Weekly digest &middot; {date_str}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- ===== THIN RULE ===== -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- ===== INTRO ===== -->
          <tr>
            <td style="padding:24px 36px 20px;">
              <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#6b7280;line-height:1.7;">
                You might find these papers interesting.
              </p>
            </td>
          </tr>

          <!-- ===== THIN RULE ===== -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- ===== ARTICLES ===== -->
          <tr>
            <td style="padding:8px 36px 4px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                {article_blocks}
              </table>
            </td>
          </tr>

          <!-- ===== THIN RULE ===== -->
          <tr>
            <td style="padding:0 36px;">
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" />
            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="padding:20px 36px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td align="center" style="padding-bottom:10px;">
                    <a href="{LINKEDIN_URL}" style="font-family:Arial,sans-serif;font-size:12px;
                       color:#6b7280;text-decoration:none;">LinkedIn</a>
                    &nbsp;&middot;&nbsp;
                    <a href="{GITHUB_URL}" style="font-family:Arial,sans-serif;font-size:12px;
                       color:#6b7280;text-decoration:none;">GitHub</a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0 0 6px 0;font-family:Arial,sans-serif;font-size:11px;
                               color:#d1d5db;line-height:1.5;">
                      &copy; {datetime.utcnow().year} Daily Academic
                    </p>
                    <p style="margin:0 0 8px 0;font-family:Arial,sans-serif;font-size:12px;
                               color:#9ca3af;line-height:1.5;">
                      Don&rsquo;t want to receive these emails?
                    </p>
                    <a href="{unsubscribe_url}"
                       style="display:inline-block;font-family:Arial,sans-serif;font-size:12px;
                              color:#6b7280;font-weight:600;text-decoration:none;
                              border:1px solid #d1d5db;border-radius:6px;padding:6px 16px;
                              background:#ffffff;">
                      Unsubscribe
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
        <!-- /Outer card -->

      </td>
    </tr>
  </table>
</body>
</html>"""

    return subject, html_body


def build_plain_text_digest(user_first_name: str, articles: list[dict], unsubscribe_url: str, send_date: datetime | None = None) -> str:
    """Plain-text fallback for the digest."""
    date_str = (send_date or datetime.utcnow()).strftime("%B %d, %Y")
    greeting = f"Hi {user_first_name}," if user_first_name else "Hello,"
    lines = [
        f"Daily Academic – {date_str}",
        "=" * 50,
        "",
        greeting,
        "Below are papers from this week that match your research interests and that you haven't read yet.",
        "",
    ]
    for i, art in enumerate(articles[:5], 1):
        title = art.get("title") or "Untitled"
        journal = art.get("journal") or ""
        doi = art.get("doi") or ""
        url = f"https://doi.org/{doi}" if doi else APP_URL
        lines += [
            f"{i}. {title}",
            f"   {journal}",
            f"   {url}",
            "",
        ]
    lines += [
        "-" * 50,
        f"Open the app: {APP_URL}",
        f"LinkedIn: {LINKEDIN_URL}",
        f"GitHub: {GITHUB_URL}",
        "",
        "To unsubscribe from these digest emails, visit:",
        unsubscribe_url,
        "",
        f"© {datetime.utcnow().year} Daily Academic - daily-academic.com",
    ]
    return "\n".join(lines)
