CREATE TABLE "attempt" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"step" "session_step" NOT NULL,
	"item" "attempt_item" NOT NULL,
	"expected_text" text NOT NULL,
	"score" smallint NOT NULL,
	"word_accuracy" smallint NOT NULL,
	"phoneme_accuracy" smallint NOT NULL,
	"fluency" smallint NOT NULL,
	"sound_results" jsonb NOT NULL,
	"weakest_sounds" text[] NOT NULL,
	"tip" text NOT NULL,
	"hint_table_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_session_step_item_uq" UNIQUE("session_id","step","item"),
	CONSTRAINT "attempt_step" CHECK ("attempt"."step" in ('speak_1', 'speak_2', 'read_aloud')),
	CONSTRAINT "attempt_score" CHECK ("attempt"."score" between 0 and 100),
	CONSTRAINT "attempt_weakest" CHECK (cardinality("attempt"."weakest_sounds") <= 3)
);
--> statement-breakpoint
CREATE TABLE "practice_session" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"chunk_id" uuid NOT NULL,
	"origin" "session_origin" NOT NULL,
	"practice_date" date NOT NULL,
	"step" "session_step" DEFAULT 'learn' NOT NULL,
	"status" "session_status" DEFAULT 'in_progress' NOT NULL,
	"counts_toward_limit" boolean DEFAULT true NOT NULL,
	"speak1_score" smallint,
	"speak2_score" smallint,
	"write_score" smallint,
	"read_aloud_score" smallint,
	"daily_score" smallint,
	"partial" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ps_speak1" CHECK (speak1_score is null or speak1_score between 0 and 100),
	CONSTRAINT "ps_speak2" CHECK (speak2_score is null or speak2_score between 0 and 100),
	CONSTRAINT "ps_write" CHECK (write_score is null or write_score between 0 and 100),
	CONSTRAINT "ps_read" CHECK (read_aloud_score is null or read_aloud_score between 0 and 100),
	CONSTRAINT "ps_daily" CHECK (daily_score is null or daily_score between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "writing_result" (
	"id" uuid PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"original" text NOT NULL,
	"corrected" text NOT NULL,
	"usage_grade" smallint NOT NULL,
	"grammar_grade" smallint NOT NULL,
	"uses_chunk" boolean NOT NULL,
	"explanation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "writing_result_position_uq" UNIQUE("session_id","position"),
	CONSTRAINT "wr_position" CHECK ("writing_result"."position" between 1 and 3),
	CONSTRAINT "wr_original_len" CHECK (char_length("writing_result"."original") between 1 and 300),
	CONSTRAINT "wr_grades" CHECK ("writing_result"."usage_grade" between 0 and 100 and "writing_result"."grammar_grade" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "audio_clip" (
	"cache_key" text PRIMARY KEY NOT NULL,
	"owner_id" text,
	"text" text NOT NULL,
	"voice_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"status" text DEFAULT 'generating' NOT NULL,
	"byte_size" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempt" ADD CONSTRAINT "attempt_session_id_practice_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_session" ADD CONSTRAINT "practice_session_chunk_id_chunk_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."chunk"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "writing_result" ADD CONSTRAINT "writing_result_session_id_practice_session_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."practice_session"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_clip" ADD CONSTRAINT "audio_clip_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_clip" ADD CONSTRAINT "audio_clip_voice_id_voice_id_fk" FOREIGN KEY ("voice_id") REFERENCES "public"."voice"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "practice_session_one_daily_idx" ON "practice_session" USING btree ("user_id","practice_date") WHERE "practice_session"."origin" = 'daily';--> statement-breakpoint
CREATE INDEX "practice_session_user_date_idx" ON "practice_session" USING btree ("user_id","practice_date");--> statement-breakpoint
CREATE INDEX "practice_session_user_chunk_idx" ON "practice_session" USING btree ("user_id","chunk_id");