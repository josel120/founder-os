CREATE TYPE "public"."evidence_kind" AS ENUM('NOTE', 'INTERVIEW', 'MARKET', 'COMPETITOR', 'SOURCE');--> statement-breakpoint
CREATE TYPE "public"."evidence_signal" AS ENUM('SUPPORTS', 'CONTRADICTS', 'NEUTRAL');--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"problem_id" uuid,
	"idea_id" uuid,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"kind" "evidence_kind" DEFAULT 'NOTE' NOT NULL,
	"signal" "evidence_signal" DEFAULT 'NEUTRAL' NOT NULL,
	"source_url" text,
	"visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evidence_exactly_one_parent" CHECK (num_nonnulls("evidence"."problem_id", "evidence"."idea_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_problem_id_problem_id_fk" FOREIGN KEY ("problem_id") REFERENCES "public"."problem"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_idea_id_idea_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."idea"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "evidence_owner_id_idx" ON "evidence" USING btree ("owner_id");