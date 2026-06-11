CREATE TYPE "public"."confidence_point" AS ENUM('start', 'mid', 'end');--> statement-breakpoint
CREATE TYPE "public"."scaffold_mode" AS ENUM('guided', 'questions_only', 'with_examples');--> statement-breakpoint
CREATE TYPE "public"."scheduled_task_kind" AS ENUM('retrospective_day_2', 'retrospective_day_14');--> statement-breakpoint
CREATE TYPE "public"."scheduled_task_status" AS ENUM('pending', 'fired', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('active', 'completed', 'abandoned');--> statement-breakpoint
CREATE TABLE "confidence_ratings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"point" "confidence_point" NOT NULL,
	"rating" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"step_id" uuid NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_pins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"public_slug" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"pinned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_pins_session_id_unique" UNIQUE("session_id")
);
--> statement-breakpoint
CREATE TABLE "retrospectives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"body" text NOT NULL,
	"written_after_days" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"session_id" uuid,
	"kind" "scheduled_task_kind" NOT NULL,
	"fire_at" timestamp with time zone NOT NULL,
	"fired_at" timestamp with time zone,
	"status" "scheduled_task_status" DEFAULT 'pending' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"problem_text" text NOT NULL,
	"subject_slug" text NOT NULL,
	"scaffold_mode" "scaffold_mode" DEFAULT 'guided' NOT NULL,
	"status" "session_status" DEFAULT 'active' NOT NULL,
	"total_steps" smallint DEFAULT 5 NOT NULL,
	"current_step" smallint DEFAULT 0 NOT NULL,
	"hints_used" smallint DEFAULT 0 NOT NULL,
	"rewrites" smallint DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"elapsed_seconds" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"step_num" smallint NOT NULL,
	"question" text NOT NULL,
	"user_response" text,
	"ai_feedback" text,
	"revision_count" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "confidence_ratings" ADD CONSTRAINT "confidence_ratings_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hints" ADD CONSTRAINT "hints_step_id_steps_id_fk" FOREIGN KEY ("step_id") REFERENCES "public"."steps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_pins" ADD CONSTRAINT "portfolio_pins_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "retrospectives" ADD CONSTRAINT "retrospectives_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "scheduled_tasks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steps" ADD CONSTRAINT "steps_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conf_session_point_idx" ON "confidence_ratings" USING btree ("session_id","point");--> statement-breakpoint
CREATE UNIQUE INDEX "portfolio_slug_idx" ON "portfolio_pins" USING btree ("public_slug");--> statement-breakpoint
CREATE INDEX "scheduled_due_idx" ON "scheduled_tasks" USING btree ("status","fire_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE INDEX "sessions_status_idx" ON "sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "steps_session_num_idx" ON "steps" USING btree ("session_id","step_num");--> statement-breakpoint
CREATE UNIQUE INDEX "subjects_slug_idx" ON "subjects" USING btree ("slug");