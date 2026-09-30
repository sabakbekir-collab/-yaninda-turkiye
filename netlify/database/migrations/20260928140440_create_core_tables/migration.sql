CREATE TABLE "api_cache" (
	"id" serial PRIMARY KEY,
	"cache_key" text NOT NULL UNIQUE,
	"payload" jsonb NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" serial PRIMARY KEY,
	"type" text NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY,
	"key" text NOT NULL UNIQUE,
	"value" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" serial PRIMARY KEY,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"phone" text NOT NULL,
	"whatsapp" text,
	"address" text NOT NULL,
	"province" text NOT NULL,
	"district" text NOT NULL,
	"description" text,
	"hours" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"latitude" double precision,
	"longitude" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "events_type_idx" ON "events" ("type");--> statement-breakpoint
CREATE INDEX "events_created_idx" ON "events" ("created_at");--> statement-breakpoint
CREATE INDEX "submissions_status_idx" ON "submissions" ("status");--> statement-breakpoint
CREATE INDEX "submissions_location_idx" ON "submissions" ("province","district");