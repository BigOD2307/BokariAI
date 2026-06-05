-- YouTube cache: durable store for search result sets and video transcripts.
-- Keyed by a namespaced hash (youtube:<query> / transcript:<videoId>:<lang>).
-- `kind` discriminates the two; `payload` holds the JSON result envelope.
CREATE TABLE IF NOT EXISTS `youtube_cache` (
  `cacheKey`  text PRIMARY KEY NOT NULL,
  `kind`      text NOT NULL,
  `videoId`   text,
  `lang`      text,
  `source`    text,
  `payload`   text NOT NULL,
  `createdAt` integer NOT NULL,
  `expiresAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_youtube_cache_expires` ON `youtube_cache` (`expiresAt`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_youtube_cache_video` ON `youtube_cache` (`videoId`);
