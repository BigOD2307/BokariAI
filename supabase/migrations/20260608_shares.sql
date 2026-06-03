-- Sprint 4 Phase 3 — Public shared chats (Bokari Pages)
-- Public page: bokari.ai/p/<slug>
-- Default indexed=true (decision Ousmane 3 juin 2026)
-- Opt-out in Settings > Privacy > Public chats

CREATE TABLE IF NOT EXISTS public.shares (
  id              TEXT PRIMARY KEY,
  chat_id         TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slug            TEXT NOT NULL UNIQUE,
  is_indexed      BOOLEAN NOT NULL DEFAULT true,
  anonymous_author BOOLEAN NOT NULL DEFAULT false,
  view_count      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at      TIMESTAMPTZ,
  revoked_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_shares_slug ON public.shares (slug);
CREATE INDEX IF NOT EXISTS idx_shares_chat_id ON public.shares (chat_id);
CREATE INDEX IF NOT EXISTS idx_shares_user_id ON public.shares (user_id);
CREATE INDEX IF NOT EXISTS idx_shares_active ON public.shares (chat_id)
  WHERE revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.share_views (
  id          BIGSERIAL PRIMARY KEY,
  share_id    TEXT NOT NULL REFERENCES public.shares(id) ON DELETE CASCADE,
  referrer    TEXT,
  country     TEXT,
  user_agent  TEXT,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_share_views_share_id ON public.share_views (share_id);
CREATE INDEX IF NOT EXISTS idx_share_views_viewed_at ON public.share_views (viewed_at DESC);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public shares are publicly readable" ON public.shares;
CREATE POLICY "Public shares are publicly readable"
  ON public.shares FOR SELECT
  USING (
    revoked_at IS NULL
    AND (expires_at IS NULL OR expires_at > now())
  );

DROP POLICY IF EXISTS "Users manage their own shares" ON public.shares;
CREATE POLICY "Users manage their own shares"
  ON public.shares FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.share_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log a share view" ON public.share_views;
CREATE POLICY "Anyone can log a share view"
  ON public.share_views FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Share owners can see their view stats" ON public.share_views;
CREATE POLICY "Share owners can see their view stats"
  ON public.share_views FOR SELECT
  USING (
    share_id IN (
      SELECT id FROM public.shares WHERE user_id = auth.uid()
    )
  );
