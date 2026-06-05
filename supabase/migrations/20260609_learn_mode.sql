-- Sprint 4 Phase 4 — Learn Mode Flashcards and Decks
-- Allows students to save cards and track daily reviews via Spaced Repetition (SM-2)

CREATE TABLE IF NOT EXISTS public.flashcard_decks (
  id           TEXT PRIMARY KEY,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  source_query TEXT NOT NULL,
  subject      TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user_id ON public.flashcard_decks (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_created_at ON public.flashcard_decks (created_at DESC);

CREATE TABLE IF NOT EXISTS public.flashcards (
  id               TEXT PRIMARY KEY,
  deck_id          TEXT NOT NULL REFERENCES public.flashcard_decks(id) ON DELETE CASCADE,
  front            TEXT NOT NULL,
  back             TEXT NOT NULL,
  ease_factor      REAL NOT NULL DEFAULT 2.5,
  interval         INTEGER NOT NULL DEFAULT 0,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  due_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reviewed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_flashcards_deck_id ON public.flashcards (deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_due_at ON public.flashcards (due_at ASC);

ALTER TABLE public.flashcard_decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own decks" ON public.flashcard_decks;
CREATE POLICY "Users manage their own decks"
  ON public.flashcard_decks FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage their own flashcards" ON public.flashcards;
CREATE POLICY "Users manage their own flashcards"
  ON public.flashcards FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.flashcard_decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.flashcard_decks d
      WHERE d.id = deck_id AND d.user_id = auth.uid()
    )
  );
