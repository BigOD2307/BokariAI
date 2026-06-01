-- =============================================================================
-- Phase 1 — Discover metadata columns
-- (urwdrdobbvkenztuhcgx)
--
-- Unlocks: language-aware ranking, real freshness, citation author,
-- pre-computed quality score at refresh time.
--
-- HOW TO APPLY:
--   Paste this file into
--   https://supabase.com/dashboard/project/urwdrdobbvkenztuhcgx/sql/new
--   then click Run.  Idempotent (safe to re-run).
-- =============================================================================

ALTER TABLE public.discover_articles
  ADD COLUMN IF NOT EXISTS language       TEXT        DEFAULT 'fr',
  ADD COLUMN IF NOT EXISTS published_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS author         TEXT,
  ADD COLUMN IF NOT EXISTS quality_score  REAL        DEFAULT 0;

-- Index for "fresh articles first" queries
CREATE INDEX IF NOT EXISTS idx_discover_articles_published_at
  ON public.discover_articles (published_at DESC NULLS LAST);

-- Index for "articles in a given language" queries
CREATE INDEX IF NOT EXISTS idx_discover_articles_language
  ON public.discover_articles (language)
  WHERE language IS NOT NULL;

-- Backfill published_at from created_at where missing (best effort,
-- keeps the existing 7-day cleanup query working until new refreshes happen)
UPDATE public.discover_articles
  SET published_at = created_at
  WHERE published_at IS NULL;
