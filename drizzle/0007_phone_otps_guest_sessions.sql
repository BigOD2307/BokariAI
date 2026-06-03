CREATE TABLE IF NOT EXISTS `phone_otps` (
  `phone` text PRIMARY KEY NOT NULL,
  `codeHash` text NOT NULL,
  `attempts` integer NOT NULL DEFAULT 0,
  `expiresAt` text NOT NULL,
  `lastSentAt` text NOT NULL,
  `verifiedAt` text,
  `createdAt` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `guest_sessions` (
  `id` text PRIMARY KEY NOT NULL,
  `queriesCount` integer NOT NULL DEFAULT 0,
  `lastResetAt` text NOT NULL,
  `createdAt` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `phoneWhatsapp` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `phoneVerifiedAt` text;
--> statement-breakpoint
ALTER TABLE `users` ADD COLUMN `authProvider` text DEFAULT 'email';
