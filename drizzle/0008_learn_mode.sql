CREATE TABLE IF NOT EXISTS `flashcard_decks` (
  `id` text PRIMARY KEY NOT NULL,
  `userId` text NOT NULL REFERENCES `users` (`id`) ON DELETE CASCADE,
  `title` text NOT NULL,
  `sourceQuery` text NOT NULL,
  `subject` text,
  `createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `flashcards` (
  `id` text PRIMARY KEY NOT NULL,
  `deckId` text NOT NULL REFERENCES `flashcard_decks` (`id`) ON DELETE CASCADE,
  `front` text NOT NULL,
  `back` text NOT NULL,
  `easeFactor` real NOT NULL DEFAULT 2.5,
  `interval` integer NOT NULL DEFAULT 0,
  `repetitions` integer NOT NULL DEFAULT 0,
  `dueAt` text NOT NULL,
  `lastReviewedAt` text
);
