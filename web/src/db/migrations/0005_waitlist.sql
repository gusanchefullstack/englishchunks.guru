CREATE TABLE "waitlist_entry" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"status" "waitlist_status" DEFAULT 'waiting' NOT NULL,
	"invite_token_hash" text,
	"invited_by" text,
	"invited_at" timestamp with time zone,
	"invite_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entry_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "waitlist_entry" ADD CONSTRAINT "waitlist_entry_invited_by_user_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;