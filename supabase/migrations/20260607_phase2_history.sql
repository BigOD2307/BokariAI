-- Sprint 4 Phase 2 — Sidebar history + auto-naming + search

-- Add updated_at for sorting history by most recent activity
ALTER TABLE public.chats
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Composite index for fast user-scoped history queries
CREATE INDEX IF NOT EXISTS idx_chats_user_updated_at
  ON public.chats (user_id, updated_at DESC);

-- French full-text search index on chat titles
CREATE INDEX IF NOT EXISTS idx_chats_title_fr
  ON public.chats USING gin (to_tsvector('french', title));

-- Backfill updated_at for existing rows so the index is consistent
UPDATE public.chats
  SET updated_at = created_at
  WHERE updated_at = now() - INTERVAL '0 seconds' AND created_at < now() - INTERVAL '1 minute';
