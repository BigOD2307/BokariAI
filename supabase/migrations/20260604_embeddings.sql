-- Migration: 20260604_embeddings.sql
-- Phase 3: BGE-M3 embeddings for hybrid retrieval.
--
-- We store embeddings as JSONB (array of floats) rather than using
-- pgvector.  Reasoning:
--   * Bokari V1 has <100k articles → in-memory cosine is fast enough
--     (1024-dim vector × 100k = ~400MB per query, well within Vercel
--     serverless function memory).
--   * JSONB is debuggable: we can `SELECT embedding[0:3] FROM …` in
--     the Supabase dashboard without installing extensions.
--   * We can swap to pgvector later with zero app-side changes — the
--     gateway writes `number[]`, the ranker reads `number[]`.
--
-- embedding_model records which model produced the vector, so a future
-- model swap can re-embed only the rows whose model doesn't match.
--
-- We do NOT add an index here.  The pipeline does brute-force cosine
-- over the candidate set (typically ~30-100 articles), so an index
-- would slow inserts and never be hit.  If we ever switch to "embed
-- the whole corpus and search it directly", we'll add an HNSW index
-- and migrate to pgvector.

ALTER TABLE discover_articles
  ADD COLUMN IF NOT EXISTS embedding JSONB,
  ADD COLUMN IF NOT EXISTS embedding_model TEXT;

-- A tiny partial index lets us cheaply check "is this article embedded?"
-- and "how many articles are embedded?".  It does not accelerate vector
-- similarity — for that we need pgvector + HNSW.
CREATE INDEX IF NOT EXISTS discover_articles_embedded_idx
  ON discover_articles (embedding_model)
  WHERE embedding IS NOT NULL;

COMMENT ON COLUMN discover_articles.embedding IS
  'BGE-M3 (or compatible) embedding of title+content.  JSONB array of floats.  Phase 3.';
COMMENT ON COLUMN discover_articles.embedding_model IS
  'Model that produced the embedding (e.g. "baai/bge-m3").  Used to detect stale vectors after a model swap.';
