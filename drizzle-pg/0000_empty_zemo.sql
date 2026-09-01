CREATE TABLE "chats" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"files" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discover_articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"url" text NOT NULL,
	"thumbnail" text,
	"domain" text,
	"batch_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"language" text DEFAULT 'fr',
	"published_at" timestamp with time zone,
	"author" text,
	"quality_score" real DEFAULT 0,
	"full_content" text,
	"extracted_at" timestamp with time zone,
	"content_hash" text,
	"embedding" jsonb,
	"embedding_model" text
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"chat_id" text,
	"user_id" uuid,
	"rating" smallint NOT NULL,
	"comment" text,
	"captured" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "feedback_rating_check" CHECK ("feedback"."rating" IN (-1, 0, 1))
);
--> statement-breakpoint
CREATE TABLE "guest_quota" (
	"fingerprint" text PRIMARY KEY NOT NULL,
	"quota_units_today" integer DEFAULT 0 NOT NULL,
	"quota_day" date DEFAULT current_date NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"message_id" text NOT NULL,
	"chat_id" text NOT NULL,
	"backend_id" text DEFAULT '' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"response_blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'answering' NOT NULL,
	CONSTRAINT "messages_status_check" CHECK ("messages"."status" IN ('answering', 'completed', 'error'))
);
--> statement-breakpoint
CREATE TABLE "share_views" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"share_id" text NOT NULL,
	"referrer" text,
	"country" text,
	"user_agent" text,
	"viewed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shares" (
	"id" text PRIMARY KEY NOT NULL,
	"chat_id" text NOT NULL,
	"user_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"is_indexed" boolean DEFAULT true NOT NULL,
	"anonymous_author" boolean DEFAULT false NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "shares_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text,
	"role" text DEFAULT 'user' NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"email_verified" boolean DEFAULT true NOT NULL,
	"quota_units_today" integer DEFAULT 0 NOT NULL,
	"quota_day" date DEFAULT current_date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_views" ADD CONSTRAINT "share_views_share_id_shares_id_fk" FOREIGN KEY ("share_id") REFERENCES "public"."shares"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shares" ADD CONSTRAINT "shares_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chats_user_id" ON "chats" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chats_created_at" ON "chats" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chats_user_updated_at" ON "chats" USING btree ("user_id","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_chats_title_fr" ON "chats" USING gin (to_tsvector('french', "title"));--> statement-breakpoint
CREATE UNIQUE INDEX "idx_discover_articles_url" ON "discover_articles" USING btree ("url");--> statement-breakpoint
CREATE INDEX "idx_discover_articles_topic" ON "discover_articles" USING btree ("topic");--> statement-breakpoint
CREATE INDEX "idx_discover_articles_batch" ON "discover_articles" USING btree ("batch_id");--> statement-breakpoint
CREATE INDEX "idx_discover_articles_created" ON "discover_articles" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_discover_articles_published_at" ON "discover_articles" USING btree ("published_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_discover_articles_language" ON "discover_articles" USING btree ("language") WHERE "discover_articles"."language" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_discover_articles_extracted_at" ON "discover_articles" USING btree ("extracted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "discover_articles_embedded_idx" ON "discover_articles" USING btree ("embedding_model") WHERE "discover_articles"."embedding" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_feedback_user_id" ON "feedback" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_chat_id" ON "feedback" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_feedback_rating" ON "feedback" USING btree ("rating");--> statement-breakpoint
CREATE INDEX "idx_feedback_created_at" ON "feedback" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feedback_message_user" ON "feedback" USING btree ("message_id",COALESCE("user_id", '00000000-0000-0000-0000-000000000000'::uuid)) WHERE "feedback"."rating" <> 0;--> statement-breakpoint
CREATE INDEX "guest_quota_day_idx" ON "guest_quota" USING btree ("quota_day");--> statement-breakpoint
CREATE INDEX "idx_messages_chat_id" ON "messages" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_messages_pair" ON "messages" USING btree ("chat_id","message_id");--> statement-breakpoint
CREATE INDEX "idx_messages_created_at" ON "messages" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_share_views_share_id" ON "share_views" USING btree ("share_id");--> statement-breakpoint
CREATE INDEX "idx_share_views_viewed_at" ON "share_views" USING btree ("viewed_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_shares_slug" ON "shares" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_shares_chat_id" ON "shares" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "idx_shares_user_id" ON "shares" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_shares_active" ON "shares" USING btree ("chat_id") WHERE "shares"."revoked_at" IS NULL;