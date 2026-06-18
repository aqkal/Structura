# Environment variables

Copy these into a `.env` file at the project root and fill in the values.
Everything starting with `.env` is gitignored.

```
NEXT_PUBLIC_SITE_URL=http://localhost:3000

NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY

DATABASE_URL=postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.PROJECT:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres

AI_PROVIDER=google
GOOGLE_GENERATIVE_AI_API_KEY=
AI_MODEL=gemini-2.5-flash
AI_DAILY_CALL_BUDGET=80

STORAGE_DAILY_BUDGET_BYTES=262144000
STORAGE_DAILY_FILE_LIMIT=50
STORAGE_UPLOADS_PER_MINUTE=20
ATTACHMENT_RETENTION_DAYS=30

CRON_SECRET=
```

`CRON_SECRET` (production) protects the scheduled cleanup endpoint
`/api/cron/cleanup-attachments`. On Vercel, set it as an env var and the
platform sends it automatically to the cron defined in `vercel.json`
(daily at 04:00 UTC). Leave blank in local dev (the endpoint then rejects
all callers).

Upload limits: 10 MB per file, 3 files per message, and per user per day
both a file count (`STORAGE_DAILY_FILE_LIMIT`) and total bytes
(`STORAGE_DAILY_BUDGET_BYTES`), plus a per-minute rate cap
(`STORAGE_UPLOADS_PER_MINUTE`).

Retention: uploaded images and PDFs are kept for `ATTACHMENT_RETENTION_DAYS`
(default 30), then removed by `scripts/cleanup-attachments.ts`. Run that on a
daily schedule (cron) in production. Set the value to 0 to disable
time-based deletion. Files are also removed immediately when their chat or
the account is deleted.
