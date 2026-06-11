CREATE TYPE "public"."usage_kind" AS ENUM('scaffold', 'feedback', 'hint', 'judge');--> statement-breakpoint
CREATE TABLE "usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" "usage_kind" NOT NULL,
	"model" text NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "usage_user_day_idx" ON "usage_events" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "usage_self_select" ON "usage_events"
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());