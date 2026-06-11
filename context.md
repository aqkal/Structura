# Structura. Project context

Structura is a Socratic AI tutoring app for students. It guides reasoning
with questions, hints only when asked, and never gives the answer. Two
modes, switchable from the nav:

- **Guided** (`/session/*`): a structured 5-step scaffold. Enter a problem,
  pick a subject and scaffold style, then work through five reasoning steps,
  each with a streamed question, your written response, and streamed
  non-revealing feedback. Confidence is captured at start, mid, and end;
  finishing shows stats, a confidence delta, and an optional reflection.
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

Works end to end on localhost against live Gemini. Not deployed; Sentry,
distributed rate limiting, CSP hardening, and CI are deferred to launch.
GDPR self-serve export and account deletion are built (Settings page).
