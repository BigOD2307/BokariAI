-- Autonomous content: AI-generated blog articles, auto-updated Africa stats,
-- and the persistent scheduler bookkeeping that drives the crons.
--
-- All three live in the local SQLite DB (sql.js, persisted to the bokari-data
-- volume). The blog read path is SQLite here (unlike Discover, which is on
-- Supabase) so the autonomous blog works on a fresh deploy with zero manual
-- migration step — drizzle/*.sql is auto-applied on boot.

CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  body TEXT NOT NULL,
  cover_image TEXT,
  sources TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  reading_minutes INTEGER NOT NULL DEFAULT 3,
  author TEXT NOT NULL DEFAULT 'Bokari',
  featured INTEGER NOT NULL DEFAULT 0,
  origin TEXT NOT NULL DEFAULT 'auto',
  generated_at TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_articles_category ON articles(category);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_articles_published ON articles(published_at DESC);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS africa_stats (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  numeric REAL,
  source_url TEXT,
  updated_at TEXT NOT NULL,
  last_checked_at TEXT
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS scheduler_state (
  job TEXT PRIMARY KEY,
  cursor INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  last_status TEXT,
  last_error TEXT,
  runs INTEGER NOT NULL DEFAULT 0
);
