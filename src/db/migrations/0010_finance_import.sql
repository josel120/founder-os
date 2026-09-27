CREATE TABLE "finance_import" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" text NOT NULL,
	"file_name" text NOT NULL,
	"row_count" integer NOT NULL,
	"imported_count" integer NOT NULL,
	"skipped_count" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "finance_import_file_name_length" CHECK (char_length("finance_import"."file_name") BETWEEN 1 AND 200),
	CONSTRAINT "finance_import_counts" CHECK ("finance_import"."row_count" >= 0 AND "finance_import"."imported_count" >= 0 AND "finance_import"."skipped_count" >= 0 AND "finance_import"."imported_count" + "finance_import"."skipped_count" <= "finance_import"."row_count")
);
--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "import_id" uuid;--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD COLUMN "import_key" text;--> statement-breakpoint
ALTER TABLE "finance_import" ADD CONSTRAINT "finance_import_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finance_import_owner_id_idx" ON "finance_import" USING btree ("owner_id","created_at");--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_import_id_finance_import_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."finance_import"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "finance_transaction_owner_import_key_idx" ON "finance_transaction" USING btree ("owner_id","import_key") WHERE "finance_transaction"."import_key" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "finance_transaction_import_id_idx" ON "finance_transaction" USING btree ("import_id");--> statement-breakpoint
ALTER TABLE "finance_transaction" ADD CONSTRAINT "finance_transaction_import_pair" CHECK (("finance_transaction"."import_id" IS NULL) = ("finance_transaction"."import_key" IS NULL));