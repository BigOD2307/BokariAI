DROP INDEX "idx_feedback_message_user";--> statement-breakpoint
CREATE UNIQUE INDEX "idx_feedback_message_user" ON "feedback" USING btree ("message_id","user_id");