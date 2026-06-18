ALTER TABLE "sessions" ADD COLUMN "intention" text DEFAULT 'dive-deep' NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "pasted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "steps" ADD COLUMN "kind" text;