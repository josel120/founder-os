ALTER TABLE "finance_transaction" ADD COLUMN "owner_id" text;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "visibility" "visibility" DEFAULT 'PRIVATE' NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;