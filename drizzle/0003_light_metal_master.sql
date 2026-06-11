CREATE TYPE "public"."chat_role" AS ENUM('user', 'assistant');--> statement-breakpoint
ALTER TYPE "public"."usage_kind" ADD VALUE 'chat';--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text DEFAULT 'New chat' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chat_id_chats_id_fk" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chats" ADD CONSTRAINT "chats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chat_messages_chat_idx" ON "chat_messages" USING btree ("chat_id","created_at");--> statement-breakpoint
CREATE INDEX "chats_user_idx" ON "chats" USING btree ("user_id","updated_at");--> statement-breakpoint
ALTER TABLE "chats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "chats_own_all" ON "chats"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());--> statement-breakpoint
CREATE POLICY "chat_messages_via_chat" ON "chat_messages"
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_messages.chat_id AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = chat_messages.chat_id AND c.user_id = auth.uid()
    )
  );