-- =============================================================================
-- Phase 2 — Content Extraction at Refresh Time
-- (urwdrdobbvkenztuhcgx)
--
-- Adds columns to store extracted article content + metadata so we don't
-- re-fetch on every user query.
--
-- HOW TO APPLY:
--   Paste into https://supabase.com/dashboard/project/urwdrdobbvkenztuhcgx/sql/new
--   then click Run.  Idempotent.
-- =============================================================================

ALTER TABLE public.discover_articles
  ADD COLUMN IF NOT EXISTS full_content TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS content_hash TEXT;

-- Index for "find me articles I already extracted for these URLs"
-- The URL index already exists (idx_discover_articles_url), so no new index needed.
-- This index helps "find un-extracted articles" queries for background workers.
CREATE INDEX IF NOT EXISTS idx_discover_articles_extracted_at
  ON public.discover_articles (extracted_at DESC NULLS LAST);
