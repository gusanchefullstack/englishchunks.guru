CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."attempt_item" AS ENUM('chunk', 'example_1', 'example_2', 'example_3', 'sentence_1', 'sentence_2', 'sentence_3');--> statement-breakpoint
CREATE TYPE "public"."audit_status" AS ENUM('pending', 'passed', 'failed', 'admin_approved');--> statement-breakpoint
CREATE TYPE "public"."cefr_level" AS ENUM('A1', 'A2', 'B1', 'B2', 'C1', 'C2');--> statement-breakpoint
CREATE TYPE "public"."chunk_source" AS ENUM('curated', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."chunk_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."chunk_type" AS ENUM('collocation', 'idiom', 'polyword', 'vague_language', 'sentence_frame', 'verb_pattern', 'discourse_marker');--> statement-breakpoint
CREATE TYPE "public"."example_register" AS ENUM('casual', 'professional');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('in_app', 'email');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('submission_accepted', 'submission_rejected', 'reminder', 'billing', 'system');--> statement-breakpoint
CREATE TYPE "public"."plan_tier" AS ENUM('basic', 'standard', 'premium');--> statement-breakpoint
CREATE TYPE "public"."points_reason" AS ENUM('session', 'streak_milestone', 'submission_accepted', 'admin_adjustment');--> statement-breakpoint
CREATE TYPE "public"."register" AS ENUM('casual', 'academic', 'professional');--> statement-breakpoint
CREATE TYPE "public"."session_origin" AS ENUM('daily', 'library');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('in_progress', 'completed', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."session_step" AS ENUM('learn', 'speak_1', 'speak_2', 'write', 'read_aloud', 'done');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'accepted', 'rejected', 'merged');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('none', 'free_basic', 'trialing', 'active', 'past_due', 'canceled', 'expired');--> statement-breakpoint
CREATE TYPE "public"."theme" AS ENUM('light', 'dark', 'system');--> statement-breakpoint
CREATE TYPE "public"."waitlist_status" AS ENUM('waiting', 'invited', 'registered', 'expired');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL,
	CONSTRAINT "rate_limit_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"display_username" text,
	"role" text DEFAULT 'learner' NOT NULL,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"age_confirmed_at" timestamp with time zone,
	"level" "cefr_level",
	"mother_tongue" text,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"image_key" text,
	"voice_id" text,
	"theme" "theme" DEFAULT 'system' NOT NULL,
	"ranking_visible" boolean DEFAULT true NOT NULL,
	"reminders_enabled" boolean DEFAULT true NOT NULL,
	"reminder_hour" smallint DEFAULT 19 NOT NULL,
	"early_tester" boolean DEFAULT false NOT NULL,
	"total_points" integer DEFAULT 0 NOT NULL,
	"current_streak" integer DEFAULT 0 NOT NULL,
	"longest_streak" integer DEFAULT 0 NOT NULL,
	"last_practice_date" date,
	"last_active_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_username_unique" UNIQUE("username"),
	CONSTRAINT "user_name_len" CHECK (char_length("user"."name") between 1 and 40),
	CONSTRAINT "user_username_fmt" CHECK ("user"."username" is null or "user"."username" ~ '^[a-z0-9_]{3,24}$'),
	CONSTRAINT "user_reminder_hour" CHECK ("user"."reminder_hour" between 0 and 23),
	CONSTRAINT "user_points_nonneg" CHECK ("user"."total_points" >= 0),
	CONSTRAINT "user_streak_nonneg" CHECK ("user"."current_streak" >= 0),
	CONSTRAINT "user_longest_ge_current" CHECK ("user"."longest_streak" >= "user"."current_streak"),
	CONSTRAINT "user_role_valid" CHECK ("user"."role" in ('learner', 'admin'))
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_audit_log" (
	"id" uuid PRIMARY KEY NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"target_id" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_setting" (
	"id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"billing_active" boolean DEFAULT false NOT NULL,
	"billing_changed_by" text,
	"billing_changed_at" timestamp with time zone,
	"account_cap" integer DEFAULT 200 NOT NULL,
	"score_weights" jsonb DEFAULT '{"speaking":40,"writing":30,"read_aloud":30}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_setting_singleton" CHECK ("app_setting"."id" = 1),
	CONSTRAINT "app_setting_cap_nonneg" CHECK ("app_setting"."account_cap" >= 0)
);
--> statement-breakpoint
CREATE TABLE "usage_counter" (
	"day" date NOT NULL,
	"metric" text NOT NULL,
	"value" bigint DEFAULT 0 NOT NULL,
	CONSTRAINT "usage_counter_day_metric_pk" PRIMARY KEY("day","metric")
);
--> statement-breakpoint
CREATE TABLE "voice" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_voice_id" text NOT NULL,
	"label" text NOT NULL,
	"gender" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chunk" (
	"id" uuid PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"normalized_text" text NOT NULL,
	"type" "chunk_type" NOT NULL,
	"level" "cefr_level" NOT NULL,
	"registers" "register"[] NOT NULL,
	"meaning" text NOT NULL,
	"usage_note" text NOT NULL,
	"ipa" text NOT NULL,
	"source" "chunk_source" DEFAULT 'curated' NOT NULL,
	"submitted_by" text,
	"audit_status" "audit_status" DEFAULT 'pending' NOT NULL,
	"audit_notes" jsonb,
	"status" "chunk_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chunk_text_len" CHECK (char_length("chunk"."text") between 1 and 80),
	CONSTRAINT "chunk_meaning_len" CHECK (char_length("chunk"."meaning") between 1 and 300),
	CONSTRAINT "chunk_usage_len" CHECK (char_length("chunk"."usage_note") between 1 and 400),
	CONSTRAINT "chunk_registers_nonempty" CHECK (cardinality("chunk"."registers") >= 1)
);
--> statement-breakpoint
CREATE TABLE "chunk_example" (
	"id" uuid PRIMARY KEY NOT NULL,
	"chunk_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"text" text NOT NULL,
	"register" "example_register" NOT NULL,
	"ipa" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chunk_example_position_uq" UNIQUE("chunk_id","position"),
	CONSTRAINT "chunk_example_position" CHECK ("chunk_example"."position" between 1 and 3),
	CONSTRAINT "chunk_example_text_len" CHECK (char_length("chunk_example"."text") between 1 and 200)
);
--> statement-breakpoint
CREATE TABLE "sound_hint" (
	"ipa_symbol" text PRIMARY KEY NOT NULL,
	"espeak_symbols" text[] NOT NULL,
	"hint" text NOT NULL,
	"example_words" text[] NOT NULL,
	"version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sound_hint_len" CHECK (char_length("sound_hint"."hint") <= 160),
	CONSTRAINT "sound_hint_examples" CHECK (cardinality("sound_hint"."example_words") between 2 and 4)
);
--> statement-breakpoint
CREATE TABLE "subscription" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tier" "plan_tier" DEFAULT 'basic' NOT NULL,
	"status" "subscription_status" DEFAULT 'free_basic' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"pm_brand" text,
	"pm_last4" text,
	"pm_exp_month" smallint,
	"pm_exp_year" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_log" ADD CONSTRAINT "admin_audit_log_actor_id_user_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_setting" ADD CONSTRAINT "app_setting_billing_changed_by_user_id_fk" FOREIGN KEY ("billing_changed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk" ADD CONSTRAINT "chunk_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chunk_example" ADD CONSTRAINT "chunk_example_chunk_id_chunk_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunk"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription" ADD CONSTRAINT "subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_username_lower_idx" ON "user" USING btree (lower("username"));--> statement-breakpoint
CREATE INDEX "user_level_idx" ON "user" USING btree ("level");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE UNIQUE INDEX "chunk_normalized_active_idx" ON "chunk" USING btree ("normalized_text") WHERE "chunk"."status" = 'active';--> statement-breakpoint
CREATE INDEX "chunk_normalized_trgm_idx" ON "chunk" USING gin ("normalized_text" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "chunk_search_idx" ON "chunk" USING gin (to_tsvector('english', "text" || ' ' || "meaning"));--> statement-breakpoint
CREATE INDEX "chunk_level_idx" ON "chunk" USING btree ("level");