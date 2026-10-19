CREATE TYPE "public"."practice_event_kind" AS ENUM('mic_denied', 'mic_unsupported', 'recording_unusable', 'upload_failed', 'scoring_unavailable', 'page_error');--> statement-breakpoint
CREATE TABLE "practice_event" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" uuid,
	"kind" "practice_event_kind" NOT NULL,
	"step" "session_step",
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_event_reason" CHECK ("practice_event"."reason" is null or length("practice_event"."reason") <= 40)
);
--> statement-breakpoint
ALTER TABLE "practice_event" ADD CONSTRAINT "practice_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_event" ADD CONSTRAINT "practice_event_session_id_practice_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_event_user_idx" ON "practice_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "practice_event_created_idx" ON "practice_event" USING btree ("created_at");