-- Sprint 4 — YouTube cache (search result sets + video transcripts)
-- Durable store keyed by a namespaced hash. Parallel to the local SQLite
-- `youtube_cache` table (drizzle/0009_youtube_cache.sql). Server-side only;
-- not exposed to clients, so RLS denies all by default (no policy = no access
-- for anon/authenticated; the service role bypasses RLS).

CREATE TABLE IF NOT EXISTS public.youtube_cache (
  cache_key   TEXT PRIMARY KEY,
  kind        TEXT NOT NULL CHECK (kind IN ('search', 'transcript')),
  video_id    TEXT,
  lang        TEXT,
  source      TEXT,
  payload     JSONB NOT NULL,
  created_at  BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_youtube_cache_expires ON public.youtube_cache (expires_at);
CREATE INDEX IF NOT EXISTS idx_youtube_cache_video ON public.youtube_cache (video_id);

ALTER TABLE public.youtube_cache ENABLE ROW LEVEL SECURITY;
-- No policies: anon/authenticated have no access; the service role (used
-- server-side) bypasses RLS, which is the only writer/reader of this cache.
