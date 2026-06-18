import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  smallint,
  integer,
  boolean,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const scaffoldMode = pgEnum("scaffold_mode", [
  "guided",
  "questions_only",
  "with_examples",
]);

export const sessionStatus = pgEnum("session_status", [
  "active",
  "completed",
  "abandoned",
]);

export const confidencePoint = pgEnum("confidence_point", [
  "start",
  "mid",
  "end",
]);

export const scheduledTaskKind = pgEnum("scheduled_task_kind", [
  "retrospective_day_2",
  "retrospective_day_14",
]);

export const scheduledTaskStatus = pgEnum("scheduled_task_status", [
  "pending",
  "fired",
  "failed",
  "cancelled",
]);

export const chatRole = pgEnum("chat_role", ["user", "assistant"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const subjects = pgTable(
  "subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    label: text("label").notNull(),
    sortOrder: smallint("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("subjects_slug_idx").on(t.slug)],
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    problemText: text("problem_text").notNull(),
    subjectSlug: text("subject_slug").notNull(),
    scaffoldMode: scaffoldMode("scaffold_mode").notNull().default("guided"),

    intention: text("intention").notNull().default("dive-deep"),

    pasted: boolean("pasted").notNull().default(false),

    summary: jsonb("summary"),
    status: sessionStatus("status").notNull().default("active"),
    totalSteps: smallint("total_steps").notNull().default(5),
    currentStep: smallint("current_step").notNull().default(0),
    hintsUsed: smallint("hints_used").notNull().default(0),
    rewrites: smallint("rewrites").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    elapsedSeconds: integer("elapsed_seconds").notNull().default(0),
  },
  (t) => [
    index("sessions_user_idx").on(t.userId, t.startedAt),
    index("sessions_status_idx").on(t.status),
  ],
);

export const steps = pgTable(
  "steps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    stepNum: smallint("step_num").notNull(),

    kind: text("kind"),
    question: text("question").notNull(),
    userResponse: text("user_response"),
    aiFeedback: text("ai_feedback"),
    revisionCount: smallint("revision_count").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("steps_session_num_idx").on(t.sessionId, t.stepNum)],
);

export const hints = pgTable("hints", {
  id: uuid("id").primaryKey().defaultRandom(),
  stepId: uuid("step_id")
    .references(() => steps.id, { onDelete: "cascade" })
    .notNull(),
  text: text("text").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const confidenceRatings = pgTable(
  "confidence_ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull(),
    point: confidencePoint("point").notNull(),
    rating: smallint("rating").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("conf_session_point_idx").on(t.sessionId, t.point)],
);

export const retrospectives = pgTable("retrospectives", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .references(() => sessions.id, { onDelete: "cascade" })
    .notNull(),
  body: text("body").notNull(),
  writtenAfterDays: smallint("written_after_days").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const portfolioPins = pgTable(
  "portfolio_pins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .references(() => sessions.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    publicSlug: text("public_slug"),
    isPublic: boolean("is_public").notNull().default(false),
    pinnedAt: timestamp("pinned_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("portfolio_slug_idx").on(t.publicSlug)],
);

export const scheduledTasks = pgTable(
  "scheduled_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "cascade",
    }),
    kind: scheduledTaskKind("kind").notNull(),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    firedAt: timestamp("fired_at", { withTimezone: true }),
    status: scheduledTaskStatus("status").notNull().default("pending"),
    payload: jsonb("payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("scheduled_due_idx").on(t.status, t.fireAt)],
);

export const usageKind = pgEnum("usage_kind", [
  "scaffold",
  "feedback",
  "hint",
  "judge",
  "chat",
]);

export const usageEvents = pgTable(
  "usage_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    sessionId: uuid("session_id").references(() => sessions.id, {
      onDelete: "set null",
    }),
    kind: usageKind("kind").notNull(),
    model: text("model").notNull(),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("usage_user_day_idx").on(t.userId, t.createdAt)],
);

export const chats = pgTable(
  "chats",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull().default("New chat"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("chats_user_idx").on(t.userId, t.updatedAt)],
);

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("chat_messages_chat_idx").on(t.chatId, t.createdAt)],
);

export const chatAttachments = pgTable(
  "chat_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: uuid("chat_id")
      .references(() => chats.id, { onDelete: "cascade" })
      .notNull(),
    messageId: uuid("message_id").references(() => chatMessages.id, {
      onDelete: "cascade",
    }),
    userId: uuid("user_id")
      .references(() => users.id, { onDelete: "cascade" })
      .notNull(),
    storagePath: text("storage_path").notNull(),
    mediaType: text("media_type").notNull(),
    fileName: text("file_name").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("chat_attachments_chat_idx").on(t.chatId, t.createdAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  scheduledTasks: many(scheduledTasks),
  chats: many(chats),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  user: one(users, { fields: [chats.userId], references: [users.id] }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(
  chatMessages,
  ({ one, many }) => ({
    chat: one(chats, { fields: [chatMessages.chatId], references: [chats.id] }),
    attachments: many(chatAttachments),
  }),
);

export const chatAttachmentsRelations = relations(
  chatAttachments,
  ({ one }) => ({
    chat: one(chats, {
      fields: [chatAttachments.chatId],
      references: [chats.id],
    }),
    message: one(chatMessages, {
      fields: [chatAttachments.messageId],
      references: [chatMessages.id],
    }),
  }),
);

export const sessionsRelations = relations(sessions, ({ one, many }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
  steps: many(steps),
  confidence: many(confidenceRatings),
  retrospectives: many(retrospectives),
  pin: one(portfolioPins, {
    fields: [sessions.id],
    references: [portfolioPins.sessionId],
  }),
}));

export const stepsRelations = relations(steps, ({ one, many }) => ({
  session: one(sessions, {
    fields: [steps.sessionId],
    references: [sessions.id],
  }),
  hints: many(hints),
}));

export const hintsRelations = relations(hints, ({ one }) => ({
  step: one(steps, { fields: [hints.stepId], references: [steps.id] }),
}));
