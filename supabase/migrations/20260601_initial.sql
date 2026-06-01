-- =============================================================================
-- Bokari initial schema for the real Supabase project
-- (urwdrdobbvkenztuhcgx)
--
-- HOW TO APPLY (one of):
--   1. Open https://supabase.com/dashboard/project/urwdrdobbvkenztuhcgx/sql
--      New query → paste this file → Run.
--   2. Or, with a personal access token (https://supabase.com/dashboard/account/tokens):
--      SUPABASE_ACCESS_TOKEN=… node scripts/apply-migrations.js
--   3. The Supabase CLI: `supabase db push` after `supabase link`.
-- =============================================================================

-- ----- 0001 · profiles (one row per auth.users entry) ------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT,
  name          TEXT,
  plan          TEXT    NOT NULL DEFAULT 'free',
  questions_today INTEGER NOT NULL DEFAULT 0,
  last_question_date TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----- 0002 · chats ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chats (
  id          TEXT PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  sources     JSONB NOT NULL DEFAULT '[]'::jsonb,
  files       JSONB NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_chats_user_id    ON public.chats (user_id);
CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats (created_at DESC);

-- ----- 0003 · messages ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id              BIGSERIAL PRIMARY KEY,
  message_id      TEXT NOT NULL,
  chat_id         TEXT NOT NULL REFERENCES public.chats(id) ON DELETE CASCADE,
  backend_id      TEXT NOT NULL DEFAULT '',
  query           TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  response_blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
  status          TEXT NOT NULL DEFAULT 'answering'
                   CHECK (status IN ('answering', 'completed', 'error'))
);
CREATE INDEX IF NOT EXISTS idx_messages_chat_id    ON public.messages (chat_id);
CREATE INDEX IF NOT EXISTS idx_messages_pair       ON public.messages (chat_id, message_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at DESC);

-- ----- 0004 · discover_articles (public news feed) ---------------------------
CREATE TABLE IF NOT EXISTS public.discover_articles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic       TEXT NOT NULL,
  title       TEXT NOT NULL,
  content     TEXT,
  url         TEXT NOT NULL,
  thumbnail   TEXT,
  domain      TEXT,
  batch_id    TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_discover_articles_url     ON public.discover_articles (url);
CREATE INDEX        IF NOT EXISTS idx_discover_articles_topic   ON public.discover_articles (topic);
CREATE INDEX        IF NOT EXISTS idx_discover_articles_batch   ON public.discover_articles (batch_id);
CREATE INDEX        IF NOT EXISTS idx_discover_articles_created ON public.discover_articles (created_at DESC);

-- ----- 0005 · Row Level Security --------------------------------------------
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discover_articles ENABLE ROW LEVEL SECURITY;

-- profiles: a user can only see/edit their own row
DROP POLICY IF EXISTS profiles_owner_all ON public.profiles;
CREATE POLICY profiles_owner_all ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- chats: a user can only see/edit their own chats
DROP POLICY IF EXISTS chats_owner_all ON public.chats;
CREATE POLICY chats_owner_all ON public.chats
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- messages: a user can see/edit messages that belong to one of their chats
DROP POLICY IF EXISTS messages_chat_owner ON public.messages;
CREATE POLICY messages_chat_owner ON public.messages
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.chats c WHERE c.id = chat_id AND c.user_id = auth.uid())
  );

-- discover_articles: public read (anyone can see), service_role-only writes
DROP POLICY IF EXISTS discover_articles_public_read ON public.discover_articles;
CREATE POLICY discover_articles_public_read ON public.discover_articles
  FOR SELECT USING (true);

-- ----- 0006 · helpful triggers ----------------------------------------------
-- When a new auth.users row appears, create a matching profiles row.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- keep updated_at honest
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_discover_articles_updated_at ON public.discover_articles;
CREATE TRIGGER trg_discover_articles_updated_at
  BEFORE UPDATE ON public.discover_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
