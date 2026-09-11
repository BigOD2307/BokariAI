-- C11: per-indicator value history. setStat() appends here whenever a refresh
-- actually changes a figure, so every displayed number is traceable (previous
-- value, source, data year) and the admin can show the before/after diff.
CREATE TABLE IF NOT EXISTS africa_stat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  numeric REAL,
  source_url TEXT,
  data_year INTEGER,
  recorded_at TEXT NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_stat_history_key ON africa_stat_history(key, recorded_at DESC);
