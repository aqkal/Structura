# Qualia. Codebase guide

A walkthrough of the whole project, written so you can read it once and then
explain the app to someone else. It goes: the big idea, the mental model,
how a request flows end to end, a tour of every folder, and the design
decisions you might get asked about.

---

## 1. What the app is

Qualia is a **Socratic AI tutor**. A student brings a topic or problem; the
app guides their thinking with questions and never hands over the answer.
There are two ways to use it, switchable from the top nav:

- **Guided mode** (`/session/...`): goal-driven thinking. The student enters
  a topic and picks one of three goals: strengthen an argument, dive deep
  into a topic, or formulate a research question. Each goal is a short
  "playbook" of typed moves (offer a counter-perspective, point out a weak
  spot, supply a piece of context, and so on). Qualia generates one move at
  a time, the student writes a response, and the next move builds on it.
  After at least three answered moves the session can end, which produces a
  **proof card**: a short record of the position the student defended and
  what they worked out, plus a visual "thinking map" of the session. Proof
  cards collect in a **portfolio** and export to a clean PDF.

- **Chat mode** (`/chat/...`): a free-form Socratic chat, like a chatbot but
  it refuses to hand over answers. Streaming replies, a conversation sidebar,
  AI-generated titles, a model picker, and image/PDF upload.

A guiding principle runs through guided mode: the AI never takes credit. The
proof card explicitly says Qualia "asked questions, gave no answers", and the
recorded insight is always attributed to the student.

---

## 2. The tech, and why each piece is there

| Piece | What it does in this app |
| --- | --- |
| **Next.js 16 (App Router)** | The whole framework. Renders pages on the server, runs the API routes, handles routing. Version 16 matters: a few APIs are async that used to be sync (see section 7). |
| **React 19** | The UI library Next renders. `"use client"` files run in the browser; everything else runs on the server. |
| **TypeScript** | Types everywhere, strict mode. Catches mistakes before runtime. |
| **Tailwind CSS v4** | Styling. Classes like `bg-surface-1` are written inline on elements. The design tokens (colours, spacing) are defined once in `globals.css`. |
| **framer-motion** | All animations (fades, the gliding pills, confetti, the streaming caret). |
| **Supabase** | The backend-as-a-service. Three parts used: Postgres (the database), Auth (login), and Storage (uploaded files). It lives in the cloud, not in this repo. |
| **Drizzle ORM** | The typed layer between our code and Postgres. We write `db.select().from(...)` in TypeScript instead of raw SQL, and Drizzle generates the migration files in `drizzle/`. |
| **Vercel AI SDK + Google Gemini** | The AI. The SDK gives a uniform `streamText` / `generateText` interface; Gemini is the actual model. |
| **Zod** | Validates every incoming request body so malformed or malicious input is rejected at the door. |

Mental model of the split: **server code** (pages by default, API routes,
anything in `lib/server/`) can touch the database and secrets. **Client code**
(files starting with `"use client"`) runs in the browser and can never see
secrets, so it talks to the server through API routes.

---

## 3. The single most important architectural idea: the persistent shell

Older versions re-rendered the entire screen (nav + sidebar + content) on
every navigation, which felt like a full page reload. The current structure
fixes that with **nested layouts**:

```
app/(app)/layout.tsx          <- mounts the nav + overlays ONCE, forever
   ├── chat/layout.tsx        <- mounts the chat sidebar, stays mounted across chats
   │      └── chat/[[...chatId]]/page.tsx   <- only this swaps when you change chat
   ├── session/layout.tsx     <- mounts the session sidebar
   │      └── session/[id]/page.tsx
   └── settings/...
```

A **layout** in Next wraps the pages beneath it and does **not** re-render
when you navigate between those pages. So:

- The nav bar and command palette mount once and never flicker.
- The chat sidebar stays put while you jump between conversations; only the
  message pane changes.

Two consequences worth keeping in mind (they caused real bugs):

1. Because the page component persists, the chat and session views are given
   a `key={id}`. React uses the key to know "this is a different entity, throw
   away the old state." Without it, opening chat B would show chat A's
   messages.
2. `/chat` and `/chat/{id}` are deliberately **one route** (an "optional
   catch-all", the `[[...chatId]]` folder). That lets a brand-new chat get
   promoted to its real URL with `history.replaceState` and **no remount**,
   so the first message and its streaming reply are never interrupted.

If you remember one thing to explain to someone, it is this: *layouts persist,
pages swap, and that is why navigation feels instant.*

---

## 4. How a request flows (the two journeys)

### Journey A: sending a chat message

1. You type in the composer in `chat-view.tsx` (a client component) and hit
   send.
2. If this is a brand-new chat, the client first calls `POST /api/chat` to
   create a chat row and get its id, optimistically dropping a "New chat" row
   into the sidebar via a small browser event.
3. The client calls `POST /api/chat/{id}/message` and reads the response as a
   **stream** (text arrives token by token via `lib/stream.ts`), rendering
   each chunk live.
4. On the server, that route handler checks you are logged in and own the
   chat (`guardChat`), rate-limits you, checks your daily AI budget, saves
   your message, then calls Gemini through `lib/server/ai/chat.ts` and pipes
   the reply back as the stream. When the reply finishes it saves the
   assistant message and, for the first message, asks Gemini for a short
   title.
5. Once the first reply is done, the client quietly changes the URL to
   `/chat/{id}` (no reload) and updates the sidebar title.

### Journey B: a guided session

1. `/session/new` is the create form. The student writes a topic and picks a
   goal (one of the three intentions in `lib/guided.ts`). Submitting creates
   the session and goes to `/session/{id}`.
2. `session-view.tsx` is a turn-based state machine. It asks the server for
   the next move with `POST /api/session/{id}/move`. The server looks up the
   goal's playbook, picks the move for this turn, and calls `generateMove`
   in `lib/server/ai/guided.ts` to produce one focused Socratic prompt.
3. The student writes a response; `POST /api/session/{id}/answer` saves it.
   The view then requests the next move, and so on.
4. After at least three answered moves (`MIN_MOVES_BEFORE_END`), the student
   can finish. `POST /api/session/{id}/end` calls `generateSummary`, which
   returns the proof card as strict JSON: the position the student defended
   and up to three things they worked out, always phrased as the student's
   own. The card is stored on the session as `summary`.
5. The finish screen (`completion.tsx`) shows the proof card and a canvas
   "thinking map" (`thinking-map.tsx`). If the student pasted large chunks
   of text instead of typing, the session is flagged and the map dims, a
   gentle signal that the thinking was outsourced.
6. `/portfolio` lists the student's proof cards. `/proof/{id}` is a
   chrome-free version of a single card built for printing and PDF export.

Every AI route follows the same shape: **guard ownership -> rate limit ->
budget check -> reserve a usage row -> generate -> persist.** If a generation
fails, its reserved usage row is deleted so a failed call does not eat the
daily budget.

---

## 5. Folder-by-folder tour

### `src/app/` (routes; this is where URLs live)

- `layout.tsx` (root): the `<html>`/`<body>`, fonts, the toast system, the
  motion config, and a tiny inline script that applies your saved light/dark
  theme before the page paints (so there is no flash).
- `globals.css`: **the entire design system.** All colours, spacing, shadows,
  fonts, the light theme (`:root`) and dark theme (`[data-theme="dark"]`), and
  reusable classes like `glass` (the frosted panels), `shimmer` (loading
  skeletons), and `stream-caret` (the blinking cursor on streaming text). To
  change how the app looks, you mostly change this one file.
- `error.tsx`, `loading.tsx`, `not-found.tsx`, `global-error.tsx`: the
  fallback screens Next shows automatically when a page errors, is loading,
  or is missing.
- `robots.ts`: tells crawlers to stay out of the app and API routes.
- `(app)/`: the route group holding the signed-in app. The parentheses mean
  the folder name is organisational only; it does not appear in the URL.
  - `(app)/layout.tsx`: mounts the persistent shell (section 3).
  - `(app)/page.tsx`: the home page. Signed out, it shows the marketing hero
    + "how it works". Signed in, it shows the dashboard (greeting, stats,
    resume card or first-run guide).
  - `(app)/chat/...`: chat mode (layout = sidebar, page = the conversation).
  - `(app)/session/...`: guided mode (`new/` is the create form, `[id]/` is
    the live session).
  - `(app)/portfolio/`: the grid of completed proof cards.
  - `(app)/settings/...`: account settings, theme, data export, account
    deletion.
- `app/proof/[id]/`: the chrome-free, print-friendly view of a single proof
  card (no nav or sidebar), used for PDF export.
- `app/auth/`: sign-in, sign-up, forgot/reset password, and the OAuth
  callback. Outside `(app)` because they have no nav/sidebar.
- `app/api/`: every backend endpoint. Each `route.ts` exports functions named
  after HTTP methods (`GET`, `POST`, ...). This is the only place the browser
  can reach the server.
  - `api/chat/...`: create a chat, send/regenerate/roll back messages, upload
    and fetch attachments.
  - `api/session/[id]/...`: `move` (next prompt), `answer` (save response),
    `end` (write the proof card), and `DELETE` (remove a session).
  - `api/account/...`: GDPR export and account deletion.
  - `api/search`: powers the command palette.
  - `api/health`: a database ping for uptime checks.
  - `api/cron/cleanup-attachments`: the scheduled job that deletes expired
    uploads and prunes stale rate-limit rows (guarded by `CRON_SECRET`).

### `src/components/` (reusable UI)

- `shell/`: the app frame. `app-shell.tsx` defines the persistent chrome and
  the sidebar/content grid. `nav.tsx`, `mode-switch.tsx` (the Chat/Guided
  toggle), `command-palette.tsx` (Ctrl+K search), the mobile drawer and
  bottom bar, the sidebars, and the dashboard stats panel.
- `chat/`: everything in chat mode. `chat-view.tsx` is the big orchestrator
  (messages, composer, streaming, uploads, scroll, stop button,
  copy/regenerate/edit). The rest are pieces it uses: the sidebar list,
  message rows, the model picker, attachment chips, typing dots.
- `session/`: guided mode. The live ones are `completion.tsx` (the finish
  screen), `proof-card.tsx` (the proof card itself, shared with the print
  view), `confetti.tsx`, and `thinking-map.tsx` (the canvas session map).
- `auth/`: the login form pieces (segmented code input, password strength
  meter, resend-code countdown, friendly error alerts).
- `onboarding/`: the home-page pieces (animated hero, sample topic cards,
  the "how it works" cards, the first-run panel).
- `ui/`: the small shared primitives (`button.tsx`, `skeleton.tsx`, the line
  illustrations).
- `render/markdown.tsx`: safely renders AI output as Markdown + math (KaTeX).
  Used by both modes, so its shape must stay stable.
- `theme-toggle.tsx`: the light/system/dark switch.
- `motion/motion-provider.tsx`: turns animations off for users who set
  "reduce motion" in their OS.

### `src/lib/` (logic, no UI)

- `lib/auth.ts`: `getCurrentUser()`, used by every protected page/route.
- `lib/guided.ts`: the guided-mode model. The three intentions, their move
  playbooks, the move labels, and the minimum-moves-before-ending rule. This
  is the single place that defines how a guided session is shaped.
- `lib/utils.ts`: small helpers (`cn` merges Tailwind classes, `siteUrl`).
- `lib/motion.ts`: the shared animation presets (durations, springs, the
  `fadeUp`/`scaleIn` variants). Import these instead of hand-tuning numbers.
- `lib/stream.ts`: the client helper that reads a streaming server response
  chunk by chunk, with an idle timeout.
- `lib/chat-models.ts`: the list of models shown in the picker (browser-safe
  copy; the server has its own authoritative list).
- `lib/hooks/`: `use-shortcuts.ts` (global keyboard shortcuts) and the
  delayed-delete "undo" pattern.
- `lib/supabase/`: the four ways to talk to Supabase: `client.ts` (browser),
  `server.ts` (server), `proxy.ts` (middleware), `admin.ts` (the service-role
  client, used only for account deletion and the cron job).
- `lib/db/`: `schema.ts` defines every table; `index.ts` is the connection.
- `lib/server/`: **the heart of the backend logic.** Server-only modules the
  API routes call:
  - `sessions.ts`, `chats.ts`: read/write the database for each mode.
  - `attachments.ts`: file upload validation, storage, limits, and retention.
  - `session-guard.ts`, `chat-guard.ts`: "is this user allowed to touch this
    thing?" (answer 404 if not, so we never reveal that it exists).
  - `usage.ts`: the daily AI-call budget (reserve, finish, refund).
  - `rate-limit.ts`: the Postgres-backed per-user/per-IP request limiter.
  - `api-error.ts`: consistent error responses with no internal leaks.
  - `audit.ts`: logging with personal data redacted.
  - `validators.ts`: the Zod schemas for request bodies.
  - `account.ts`: the GDPR export + delete logic.
  - `stats.ts`: the dashboard number-crunching.
  - `ai/`: the AI layer. `provider.ts` picks and validates the model,
    `guided.ts` holds the guided-mode moves and proof-card generation,
    `chat.ts` holds the chat-mode calls, and `prompts/chat.md` is the chat
    tutor's voice. (`index.ts` and `prompts/scaffold|feedback|hint.md` back
    the eval harness.)

### `src/proxy.ts` (the gatekeeper)

Runs on **every** request before it reaches a page. It refreshes the login
session, applies a per-IP rate limit, and redirects logged-out users away
from protected pages. (In Next 16 this file replaces `middleware.ts`.)

### Top-level files

- `drizzle/`: the database migration files (the recorded history of schema
  changes). `npm run db:migrate` replays them to build the DB.
- `scripts/`: one-off setup/maintenance scripts (create the storage bucket,
  print the storage RLS SQL, verify the DB is healthy, clean up attachments).
- `evals/`: a harness that runs sample prompts through the AI and checks the
  tutor stays Socratic (never reveals answers).
- `tests/`: Playwright end-to-end test skeleton.
- Config: `package.json`, `next.config.ts`, `tsconfig.json`,
  `eslint.config.mjs`, `drizzle.config.ts`, `playwright.config.ts`,
  `vercel.json` (cron schedule).
- Docs: `README.md` (how to run), `context.md` (short overview), `SECURITY.md`
  (security policy), and `info.md` (this file).

---

## 6. The database, in plain terms

Postgres, accessed through Drizzle. The tables the current app uses:

- `users`: one row per account (auto-created on sign-up).
- `subjects`: a seeded reference list.
- `sessions`: one guided session. Holds the topic (`problem_text`), the chosen
  `intention`, whether the student `pasted` text, the proof card (`summary`,
  JSON), status, and timing.
- `steps`: the per-move turns of a session (the move `kind`, the `question`
  Qualia asked, and the student's `user_response`).
- `chats`, `chat_messages`, `chat_attachments`: chat mode (conversation,
  messages, uploaded files).
- `usage_events`: one row per AI call, used to enforce the daily budget.
- `portfolio_pins`: links a session into the portfolio (and an optional public
  slug).
- `rate_limits`: the shared counter behind the rate limiter (one row per
  key + time window).

A few tables (`hints`, `confidence_ratings`, `retrospectives`,
`scheduled_tasks`) are carried over from an earlier design and are not part of
the current flow; some are still read by the GDPR export.

Every table has **Row-Level Security (RLS)** turned on. That is a Postgres
feature where the database itself refuses to return rows that do not belong to
the logged-in user, even if our code has a bug. It is the safety net under the
app-level ownership guards.

---

## 7. Next.js 16 things that surprise people

- The middleware file is `src/proxy.ts` and exports a function called `proxy`
  (not `middleware`).
- `cookies()`, `headers()`, and a page's `params` / `searchParams` are now
  **async** (you `await` them). Forgetting this is the most common error.
- Turbopack is the default build tool; there is no `--turbopack` flag.

---

## 8. Security model (the short version)

- Login via Supabase, tokens kept in secure http-only cookies.
- RLS on every table + ownership guards in every route (return 404, never
  403, so attackers cannot even confirm a resource exists).
- The service-role database key is never used by the running app except for
  account deletion and the scheduled cron; normal operations use the
  logged-in user's own permissions.
- Uploads are checked by their real file bytes (not just the extension),
  size-capped, retained for a fixed window, and served back so the browser
  cannot execute them.
- Per-user rate limits (shared across instances via Postgres) and a daily AI
  budget stop abuse and runaway cost.
- The AI prompts treat everything the student types as untrusted data and end
  with a rule to refuse "ignore your instructions" style attacks.
- No personal data in logs or error messages.

Full detail is in `SECURITY.md`.

---

## 9. How to talk about it in one paragraph

"Qualia is a Next.js 16 + Supabase app where students get Socratically tutored
by Gemini. It has two modes: a goal-driven guided session that ends with a
proof card of the student's own reasoning, and a free-form chat. The frontend
is React with Tailwind and framer-motion; the backend is Next API routes over
a Postgres database through Drizzle, with row-level security, distributed rate
limiting, and per-user AI budgets. The standout architectural choice is a
persistent layout shell, so navigating between chats or modes swaps only the
content pane instead of reloading the page, and the guided experience is driven
by editable move playbooks rather than hard-coded steps."
