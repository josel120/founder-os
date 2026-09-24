ALTER TABLE "idea" ADD COLUMN "owner_id" text;
--> statement-breakpoint
ALTER TABLE "problem" ADD COLUMN "owner_id" text;
--> statement-breakpoint
ALTER TABLE "idea" ADD CONSTRAINT "idea_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "problem" ADD CONSTRAINT "problem_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
