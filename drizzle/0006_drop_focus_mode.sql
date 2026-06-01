-- Drop vestigial NOT NULL column from chats.
-- focusMode was never wired up to the application code (the schema.ts
-- definition and every consumer omit it). Production inserts via
-- /api/chat's ensureChatExists were silently failing the NOT NULL
-- check the moment any DB-backed flow ran.
-- Requires SQLite >= 3.35 (sql.js 1.10+ ships 3.46, so we're fine).
ALTER TABLE `chats` DROP COLUMN `focusMode`;
