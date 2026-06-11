# Structura

A Socratic AI tutor. It guides your thinking through hard problems with
questions and hints; it never gives the answer. Two modes: a structured
5-step **Guided** session and a free-form **Chat** tutor.

See `context.md` for an architecture overview and `SECURITY.md` for the
security policy.

## Stack

| Layer       | Pick                                              |
| ----------- | ------------------------------------------------- |
| Framework   | Next.js 16 (App Router) + React 19 + TypeScript   |
| Styling     | Tailwind CSS v4, light + dark themes              |
| Animation   | framer-motion                                     |
| DB          | Supabase Postgres (RLS everywhere)                |
| Auth        | Supabase Auth (password, email OTP, Google OAuth) |
| Storage     | Supabase Storage (private bucket, chat uploads)   |
| ORM         | Drizzle                                           |
| AI          | Vercel AI SDK + Google Gemini                     |
| Lint/Format | ESLint + Prettier                                 |

## Run it locally

### 1. External accounts (all free)

1. **Supabase**: [supabase.com](https://supabase.com), new project. From
   **Settings > API** copy the project URL, the anon key, and the
   service-role key. From **Database > Connect** copy the transaction
   pooler URL (port 6543) and the session/direct URL (port 5432).
2. **Gemini API key**: [aistudio.google.com/apikey](https://aistudio.google.com/apikey).
3. **Google OAuth** (optional; password + OTP work without it):
   create an OAuth client in Google Cloud Console with redirect URI
   `https://YOUR-PROJECT.supabase.co/auth/v1/callback`, then enable the
   Google provider in Supabase Auth and paste the client ID + secret.
4. In Supabase **Authentication**: enable the Email provider. Set a custom
   SMTP sender so OTP/confirmation emails actually send.

### 2. Configure env

```bash
cp .env.example .env
```

Required keys:

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # admin scripts + account deletion only
DATABASE_URL=...                     # transaction pooler, port 6543
DIRECT_URL=...                       # direct/session pooler, port 5432
AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=...
```

Optional: `AI_MODEL` (default gemini-2.5-flash), `AI_DAILY_CALL_BUDGET`
(default 80), `STORAGE_DAILY_BUDGET_BYTES` (default 262144000).

### 3. Database and storage

```bash
npm install
npm run db:migrate                     # applies the committed migrations
npx tsx scripts/setup-storage.ts       # one-time: creates the chat-uploads bucket
npx tsx scripts/setup-storage-rls.ts   # prints SQL; paste it into the
                                       # Supabase dashboard SQL editor (one-time)
npx tsx scripts/verify-db.ts           # canary: tables, RLS, seeds, trigger
```

The storage RLS step is manual because Supabase does not allow
`storage.objects` policies over a normal DB connection. Until it is
applied, text chat works and file uploads are denied (fail closed).

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and create an account.

## Scripts

| Command               | What it does                              |
| --------------------- | ----------------------------------------- |
| `npm run dev`         | Dev server on :3000 (Turbopack)           |
| `npm run build`       | Production build                          |
| `npm run start`       | Serve the production build                |
| `npm run typecheck`   | TypeScript, no emit                       |
| `npm run lint`        | ESLint                                    |
| `npm run format`      | Prettier write                            |
| `npm run db:generate` | Generate Drizzle migrations from schema   |
| `npm run db:migrate`  | Apply migrations                          |
| `npm run db:studio`   | Drizzle Studio                            |
| `npm run eval`        | Prompt eval harness (free-tier throttled) |
| `npm run test:e2e`    | Playwright E2E tests                      |

## Next.js 16 notes

- Middleware is `src/proxy.ts` exporting `proxy()`.
- `cookies()`, `headers()`, `params`, `searchParams` are all async.
- Turbopack is the default builder; `next lint` is gone (ESLint is called
  directly).

## Gemini notes

- `gemini-2.5-flash` is the verified free-tier default. The model picker
  offers the allowlisted alternatives; the server validates every request.
- Free-tier daily quotas are real: the per-user in-app budget
  (`AI_DAILY_CALL_BUDGET`) keeps a single user from burning the key.
