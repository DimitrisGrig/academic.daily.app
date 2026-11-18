-- Migration: Add indexes on wos_journals_clarivate_rankings(issn) and (eissn)
-- This enables fast OR-based joins from articles.issn to either column.
-- Without these indexes the OR join causes a full table scan and is very slow.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wos_journals_issn
    ON wos_journals_clarivate_rankings (issn);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_wos_journals_eissn
    ON wos_journals_clarivate_rankings (eissn);
