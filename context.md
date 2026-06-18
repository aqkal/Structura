# Qualia. Project context

Qualia is a Socratic AI tutoring app for students. It guides reasoning
with questions and never gives the answer. Two modes, switchable from the
nav:

- **Guided** (`/session/*`): the student enters a topic and picks a goal
  (strengthen an argument, dive deep, or shape a research question). Each
  goal is a short playbook of typed thinking moves. Qualia generates one
  move at a time, the student answers, and after at least three answered
  moves the session can end. Ending produces a proof card that records the
  position the student defended and what they worked out, alongside a
  visual thinking map. Proof cards collect in a portfolio and export to PDF.
- **Chat** (`/chat/*`): a free-form Socratic tutor with streaming replies,
  a recency-grouped sidebar, AI-generated titles, model switching, and
  image/PDF upload.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS v4
(token-based design system with light and dark themes), framer-motion,
Supabase (Postgres, Auth, Storage), Drizzle ORM, Vercel AI SDK with Google
Gemini (default `gemini-2.5-flash`), react-markdown + KaTeX.

## How it is organized

- `src/app/(app)/` holds the signed-in app behind persistent layouts: the
  nav chrome mounts once, each section (chat, session, settings) keeps its
  sidebar mounted, and navigation only swaps the content pane. `/chat` and
  `/chat/{id}` are one optional-catch-all route so a new conversation can
  take its real URL without any remount.
- `src/app/auth/` holds sign-in, sign-up, and password reset (password,
  email OTP code, Google OAuth).
- `src/app/api/` holds the route handlers. Every route is auth and
  ownership guarded (missing or unowned resources answer 404), rate
  limited, and zod validated. AI calls run through a per-user daily budget.
- `src/lib/server/` holds DB helpers, the AI layer, guards, validation,
  usage budgeting, and logging. The Socratic prompt voice lives in
  `src/lib/server/ai/prompts/*.md`.
- `src/components/` holds the shell (nav, sidebars, palette, dialogs),
  chat and session UI, and shared primitives. `src/lib/motion.ts` defines
  the shared animation vocabulary.

## Security posture

Row-level security on every table, ownership guards in every route, no
service-role key in the running app (admin client only for account
deletion), magic-number validated uploads served inert, per-user rate
limits and AI budgets, prompts that treat user content as data and refuse
instruction injection, no PII in logs or error responses. `SECURITY.md`
is the full policy and launch checklist.

## State

Runs end to end on localhost against live Supabase and Gemini. Rate limiting
is distributed (Postgres-backed) and CI runs typecheck, lint, and build on
every push. GDPR self-serve export and account deletion are built into the
Settings page. Remaining launch work (error monitoring, nonce-based CSP) is
tracked in `SECURITY.md`.
