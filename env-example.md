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
```

| Variable | Required | Where to get it |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your domain, or `http://localhost:3000` in dev |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase dashboard, Settings > API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase dashboard, Settings > API (anon/publishable) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase dashboard, Settings > API (secret, server only) |
| `DATABASE_URL` | Yes | Supabase Database > Connect, transaction pooler (port 6543) |
| `DIRECT_URL` | Yes | Supabase Database > Connect, session pooler (port 5432) |
| `AI_PROVIDER` | Yes | Set to `google` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | aistudio.google.com/apikey |
| `AI_MODEL` | No | Defaults to `gemini-2.5-flash` |
| `AI_DAILY_CALL_BUDGET` | No | Defaults to `80` |
| `STORAGE_DAILY_BUDGET_BYTES` | No | Defaults to `262144000` (250 MB) |
