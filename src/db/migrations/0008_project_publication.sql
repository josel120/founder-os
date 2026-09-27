CREATE TABLE "project_publication" (
	"project_id" uuid PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"visibility" "visibility" NOT NULL,
	"summary" text NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "project_publication_not_private" CHECK ("project_publication"."visibility" <> 'PRIVATE'),
	CONSTRAINT "project_publication_summary_length" CHECK (char_length(btrim("project_publication"."summary")) BETWEEN 1 AND 500)
);
--> statement-breakpoint
ALTER TABLE "project_publication" ADD CONSTRAINT "project_publication_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_publication" ADD CONSTRAINT "project_publication_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_publication_list_idx" ON "project_publication" USING btree ("visibility","published_at");--> statement-breakpoint
CREATE INDEX "project_publication_owner_id_idx" ON "project_publication" USING btree ("owner_id");