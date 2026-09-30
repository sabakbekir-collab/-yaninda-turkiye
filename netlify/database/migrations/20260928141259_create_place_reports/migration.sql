CREATE TABLE "reports" (
	"id" serial PRIMARY KEY,
	"place_id" text NOT NULL,
	"place_name" text NOT NULL,
	"reason" text NOT NULL,
	"details" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" ("status");