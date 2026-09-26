ALTER TABLE "evidence" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "evidence" ALTER COLUMN "signal" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "evidence_problem_id_idx" ON "evidence" USING btree ("problem_id");--> statement-breakpoint
CREATE INDEX "evidence_idea_id_idx" ON "evidence" USING btree ("idea_id");