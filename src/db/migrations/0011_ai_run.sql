CREATE TYPE "public"."ai_run_kind" AS ENUM('ASSESSMENT', 'SUMMARY');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('RUNNING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"idea_id" uuid NOT NULL,
	"kind" "ai_run_kind" NOT NULL,
	"status" "ai_run_status" DEFAULT 'RUNNING' NOT NULL,
	"recommendation" text,
	"output" jsonb,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"input_tokens" integer,
	"output_tokens" integer,
	"error" text,
	"visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ai_run_recommendation" CHECK ((("ai_run"."kind" = 'ASSESSMENT' AND "ai_run"."status" = 'SUCCEEDED') = ("ai_run"."recommendation" IS NOT NULL)) AND ("ai_run"."recommendation" IS NULL OR "ai_run"."recommendation" IN ('CONTINUE', 'INVESTIGATE_MORE', 'PAUSE', 'REJECT'))),
	CONSTRAINT "ai_run_outcome" CHECK (("ai_run"."status" = 'SUCCEEDED') = ("ai_run"."output" IS NOT NULL) AND ("ai_run"."status" = 'FAILED') = ("ai_run"."error" IS NOT NULL) AND ("ai_run"."status" = 'RUNNING') = ("ai_run"."finished_at" IS NULL)),
	CONSTRAINT "ai_run_error" CHECK ("ai_run"."error" IS NULL OR "ai_run"."error" IN ('unauthorized', 'rate_limited', 'unavailable', 'invalid_output', 'too_large', 'interrupted')),
	CONSTRAINT "ai_run_tokens" CHECK (coalesce("ai_run"."input_tokens", 0) >= 0 AND coalesce("ai_run"."output_tokens", 0) >= 0),
	CONSTRAINT "ai_run_labels" CHECK (char_length("ai_run"."model") BETWEEN 1 AND 100 AND char_length("ai_run"."prompt_version") BETWEEN 1 AND 40),
	CONSTRAINT "ai_run_private" CHECK ("ai_run"."visibility" = 'PRIVATE')
);
--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run" ADD CONSTRAINT "ai_run_idea_id_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."idea"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_run_owner_created_idx" ON "ai_run" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX "ai_run_idea_created_idx" ON "ai_run" USING btree ("idea_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_one_running_per_idea_idx" ON "ai_run" USING btree ("idea_id") WHERE "ai_run"."status" = 'RUNNING';