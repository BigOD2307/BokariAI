-- Discover articles table for pre-fetched African news.
-- Updated 3x/day by /api/discover/refresh.
-- SQLite dialect (the previous version used PostgreSQL syntax and would fail).

CREATE TABLE IF NOT EXISTS `discover_articles` (
  `id` TEXT PRIMARY KEY,
  `topic` TEXT NOT NULL,
  `title` TEXT NOT NULL,
  `content` TEXT,
  `url` TEXT NOT NULL,
  `thumbnail` TEXT,
  `domain` TEXT,
  `batch_id` TEXT NOT NULL,
  `created_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS `idx_discover_articles_topic` ON `discover_articles` (`topic`);
CREATE INDEX IF NOT EXISTS `idx_discover_articles_batch` ON `discover_articles` (`batch_id`);
CREATE INDEX IF NOT EXISTS `idx_discover_articles_created` ON `discover_articles` (`created_at` DESC);
CREATE UNIQUE INDEX IF NOT EXISTS `idx_discover_articles_url` ON `discover_articles` (`url`);
