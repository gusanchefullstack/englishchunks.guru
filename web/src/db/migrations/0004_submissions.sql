CREATE TABLE "chunk_submission" (
	"id" uuid PRIMARY KEY NOT NULL,
	"submitted_by" text,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"proposed_meaning" text,
	"proposed_example" text,
	"matched_chunk_ids" uuid[] DEFAULT '{}' NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"merged_into" uuid,
	"reviewer_id" text,
	"decision_reason" text,
	"decided_at" timestamp with time zone,
	"resulting_chunk_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chunk_submission" ADD CONSTRAINT "chunk_submission_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_submission" ADD CONSTRAINT "chunk_submission_reviewer_id_user_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_submission" ADD CONSTRAINT "chunk_submission_resulting_chunk_id_chunk_id_fk" FOREIGN KEY ("resulting_chunk_id") REFERENCES "public"."chunk"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunk_submission_status_idx" ON "chunk_submission" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chunk_submission_key_idx" ON "chunk_submission" USING btree ("normalized_text");