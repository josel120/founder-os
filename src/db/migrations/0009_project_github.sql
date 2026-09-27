CREATE TABLE "project_github" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"repo_full_name" text NOT NULL,
	"default_branch" text,
	"last_push_at" timestamp with time zone,
	"open_issues" integer,
	"open_pull_requests" integer,
	"latest_release_tag" text,
	"latest_release_at" timestamp with time zone,
	"synced_at" timestamp with time zone DEFAULT now() NOT NULL,
	"sync_error" text,
	CONSTRAINT "project_github_repo_format" CHECK ("project_github"."repo_full_name" ~ '^[A-Za-z0-9-]{1,39}/[A-Za-z0-9._-]{1,100}$'),
	CONSTRAINT "project_github_counts" CHECK (coalesce("project_github"."open_issues", 0) >= 0 AND coalesce("project_github"."open_pull_requests", 0) >= 0),
	CONSTRAINT "project_github_sync_error" CHECK ("project_github"."sync_error" IS NULL OR "project_github"."sync_error" IN ('not_found', 'unauthorized', 'rate_limited', 'unavailable'))
);
--> statement-breakpoint
ALTER TABLE "project_github" ADD CONSTRAINT "project_github_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_github" ADD CONSTRAINT "project_github_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_github_owner_id_idx" ON "project_github" USING btree ("owner_id");