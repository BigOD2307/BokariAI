-- =============================================================================
-- Migration: 20260605_feedback.sql
-- Phase 8: User feedback loop (thumbs up/down + optional comment).
--
-- Each assistant message can receive feedback.  We store:
--   * `rating`  -1 (👎) / 0 (cleared) / 1 (👍)
--   * `comment` optional short free-text from the user
--   * `captured` JSONB with the full conversation snapshot:
--       { query, response, sources, metadata }
--     so the row is self-contained — we can drop a single feedback row
--     into a fine-tuning set without joining other tables.
--
-- `message_id` is unique with a partial index, so re-submission upserts
-- the row (toggling thumbs updates the same row, not creating duplicates).
-- `user_id` is nullable so anonymous visitors (cookies disabled) can still
-- leave feedback; their rows are still subject to RLS (see policy below).
-- =============================================================================

-- ----- 0001 · feedback table ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.feedback (
  id          BIGSERIAL PRIMARY KEY,
  message_id  TEXT NOT NULL,
  chat_id     TEXT,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating      SMALLINT NOT NULL
              CHECK (rating IN (-1, 0, 1)),
  comment     TEXT,
  captured    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active row per (message_id, user_id) pair.
-- Anonymous rows share user_id = NULL; the partial index allows
-- multiple anon rows for the same message (idempotency best-effort
-- for unauthed users, with rate-limiting at the API layer).
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedback_message_user
  ON public.feedback (message_id, COALESCE(user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE rating <> 0;

CREATE INDEX IF NOT EXISTS idx_feedback_user_id    ON public.feedback (user_id);
CREATE INDEX IF NOT EXISTS idx_feedback_chat_id    ON public.feedback (chat_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating     ON public.feedback (rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback (created_at DESC);

-- ----- 0002 · Row Level Security --------------------------------------------
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can insert/read/update their own rows.
-- The anon write path goes through the service-role client on the server
-- (see /api/feedback), which bypasses RLS.  This means we never expose
-- the table to direct anonymous browser writes.
DROP POLICY IF EXISTS feedback_owner_all ON public.feedback;
CREATE POLICY feedback_owner_all ON public.feedback
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ----- 0003 · keep updated_at honest ----------------------------------------
DROP TRIGGER IF EXISTS trg_feedback_updated_at ON public.feedback;
CREATE TRIGGER trg_feedback_updated_at
  BEFORE UPDATE ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON TABLE public.feedback IS
  'User feedback (thumbs + comment + captured conversation context).  Phase 8.';
COMMENT ON COLUMN public.feedback.rating IS
  '-1 = 👎, 0 = cleared, 1 = 👍.  Re-submission upserts the same row.';
COMMENT ON COLUMN public.feedback.captured IS
  'Self-contained snapshot: { query, response, sources, metadata }.  Lets us drop a row into a fine-tuning set without joining other tables.';
