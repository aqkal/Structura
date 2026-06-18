# Qualia. Security policy

This is the single source of truth for everything security-related in Qualia:
the threat model, the controls in place, how user data is handled, what to
verify before public launch, how to report a vulnerability, and the runbooks
for when something goes wrong.

If you are building on the project, skim the quick reference and the threat
model. If you are auditing it, read top to bottom.

---

## Quick reference

- **Where secrets live:** `.env` (gitignored). Never in code, never in commit
  messages, never in logs.
- **Who can read a user's data:** that user only, enforced by Postgres
  row-level security (RLS). The service-role key bypasses RLS and is used by
  the server in exactly two places (account deletion and the scheduled cron).
- **What protects the AI endpoints:** auth + ownership check + Zod validation
  + per-IP rate limit + per-user daily call budget + the Gemini provider quota
  or billing cap.
- **Reporting a vulnerability:** see [Reporting](#reporting-a-vulnerability).
- **Before going public:** see [Launch checklist](#launch-checklist).

---

## Threat model

Concrete threats the project considers and the layer that mitigates each.

| Threat | Mitigation |
| --- | --- |
| Unauthorized read of another user's sessions, chats, or files | RLS on every table + explicit `userId` checks in server helpers + the session/chat guards |
| Stolen or leaked API key | `.env` gitignored, server-only usage, rotation runbook below, provider quota / billing cap caps blast radius |
| SQL injection | Drizzle parameterized queries throughout. Raw SQL only in reviewed migration files, which never take runtime input |
| XSS via AI output or user input | All model output and user text render through `react-markdown` with HTML escaping on; raw HTML is deliberately not enabled |
| CSRF on state-changing endpoints | SameSite auth cookies + explicit auth checks on every route |
| Clickjacking | `X-Frame-Options: DENY` and `frame-ancestors 'none'` |
| MITM / downgrade | HSTS in production (`Strict-Transport-Security`) |
| Brute-force sign-in | Supabase's own auth rate limit + our per-IP limit on `/auth/*` |
| OTP spam / email enumeration | Supabase OTP returns success regardless of whether the email exists; the per-IP limit caps iteration speed |
| Application-layer flooding | Distributed per-IP and per-user rate limits (Postgres-backed, so they hold across every serverless instance) |
| AI cost runaway | Per-user daily call budget + provider quota / billing cap + abort signals on every generation |
| Prompt injection (user content overriding the system prompt) | Topic and student text are passed as user-role data, never interpolated into the system prompt; the system prompt ends with a "do not break role" rule; the eval harness includes an injection case |
| Malicious file upload | Uploads are validated by their real magic-number bytes (not the extension), size-capped, and served back with `nosniff` and a locked-down CSP so they cannot execute |
| Data leak via error messages | Every route responds through `apiError(...)`; production responses carry no stack traces, DB error text, or internal IDs |
| Resource enumeration | UUID primary keys; public portfolio slugs are random; unauthorized probes get 404, not 403, so existence is never confirmed |
| Open redirect | The `next` query param on sign-in is validated to be a path on our own origin |

---

## Controls in place

### Authentication and access

- Supabase Auth with three sign-in paths: email + password, email OTP code,
  and Google OAuth. Tokens are stored in http-only, SameSite cookies.
- The proxy (`src/proxy.ts` + `src/lib/supabase/proxy.ts`) refreshes the
  session on every request and redirects unauthenticated traffic away from
  protected pages.
- RLS is enabled on every table; `scripts/verify-db.ts` confirms it stays on
  after each migration.
- Every API route loads the user and checks ownership through
  `session-guard.ts` / `chat-guard.ts`, returning 404 on a miss.
- The service-role key is never imported into any client file. It is used
  server-side only for account deletion and the scheduled cleanup cron.

### Input and output

- Every request body is validated with a Zod schema (`validators.ts`).
- All AI and user text is rendered through one safe Markdown pipeline with
  HTML escaping; math is rendered with KaTeX.
- Errors return through `apiError(...)`, which strips internal detail in
  production.

### AI safety and cost

- The system prompt for each mode ends with an explicit rule to refuse
  instruction-injection and role-change attempts. Topic and student text are
  always passed as user-role data.
- Each AI call reserves a `usage_events` row before it runs, so a burst of
  concurrent requests cannot all slip past a stale count. A failed generation
  refunds its reservation so it does not consume the daily budget.
- Every streaming and generation call carries an abort signal and a timeout,
  so a closed tab or a slow upstream cancels the call.

### Files and storage

- The app holds no master storage key at runtime. Uploads and downloads use
  each user's own Supabase session, and Storage RLS scopes every object to the
  owner's folder (`{userId}/{chatId}/...`).
- `uploadAttachment` checks the real magic-number bytes against the claimed
  media type, so a script payload cannot masquerade as an allowed image. SVG
  is intentionally not on the allowlist.
- Served attachments carry `X-Content-Type-Options: nosniff` and a
  `default-src 'none'; sandbox` CSP, so a slipped-through file stays inert.
- Upload limits: 10 MB per file, 3 files per message, and per user per day a
  file-count cap, a total-bytes cap, and a per-minute rate cap.
- Uploaded files are retained for a fixed window (`ATTACHMENT_RETENTION_DAYS`,
  default 30) and then removed by the daily cron, and are deleted immediately
  when their chat or the owning account is deleted.

### Network and headers

- `next.config.ts` sets baseline security headers on every response: nosniff,
  `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy, a baseline
  Content-Security-Policy, and HSTS in production. `X-Powered-By` is off.
- Logging (`audit.ts`) redacts personal data; database and provider error text
  is never logged (only the error class name).

---

## Known limitations (intentional)

- **CSP allows inline scripts.** The baseline CSP uses `script-src
  'unsafe-inline'`. Moving to per-request nonces is the planned hardening step
  (see the checklist).
- **AI persistence after a stream is fire-and-forget.** If the database write
  fails after a reply has finished streaming, the failure is logged
  (`persist_failed`) but not retried; the HTTP response was already sent. A
  durable retry queue is a future resilience upgrade.
- **Uploaded file contents are not scanned for injection markers.** Gemini
  treats files as data, not instructions, and the system prompt is
  injection-resistant, so this is a logging gap rather than a bypass.

---

## Data handling and PII

What the app stores, where, and for how long.

| Data | Stored in | Retention |
| --- | --- | --- |
| Email address | `auth.users` + `public.users` | until account deletion |
| Display name, avatar (optional, from OAuth) | `public.users` | until account deletion |
| Topic text (user-typed) | `public.sessions.problem_text` | until account deletion |
| Student responses | `public.steps.user_response` | until account deletion |
| Proof card | `public.sessions.summary` (JSON) | until account deletion |
| Chat messages | `public.chat_messages.content` | until account or chat deletion |
| Uploaded files | Supabase Storage + `public.chat_attachments` | `ATTACHMENT_RETENTION_DAYS` (default 30), or on chat/account deletion |
| AI usage events | `public.usage_events` | until account deletion |
| Auth tokens | http-only cookies | session-bound, per Supabase config |
| Logs | platform log store | per platform retention |

All rows carry an `onDelete: cascade` foreign key to the user, so deleting an
account purges that user's data. Encryption at rest and TLS in transit are
provider-managed by Supabase. The app does not store passwords (Supabase Auth
handles them), payment info, IP addresses in the database, or any government
identifiers.

### GDPR

- **Export:** a user can download all their data as JSON from the Settings
  page (`/api/account/export`).
- **Deletion:** a user can delete their account and all associated data from
  the Settings page (`/api/account/delete`), which removes storage objects,
  database rows, and the auth user in order. This is irreversible.

---

## Launch checklist

Verify all of these before serving public traffic:

- HTTPS with a valid certificate (automatic on Vercel).
- Security headers returned on every response (test with securityheaders.com).
- The Content-Security-Policy is enforced, not report-only.
- Production environment variables set in the host (never the service-role key
  in any `NEXT_PUBLIC_` variable).
- A production Gemini key distinct from the dev key, with a billing cap if on
  a paid tier.
- `CRON_SECRET` set so the cleanup/retention cron runs.
- The production domain added to Supabase Auth Site URL and Redirect URLs, and
  to the Google OAuth authorized redirect URI.
- Production SMTP configured in Supabase Auth so verification and OTP emails
  send.
- `npm run db:migrate` applied against the production database, then
  `scripts/verify-db.ts` passes against it.
- The `chat-uploads` bucket exists and its RLS policies are applied.
- Daily database backups confirmed, and a restore drill performed at least
  once.
- Error monitoring (for example Sentry) wired with PII scrubbing.
- `npm audit` clean of high/critical issues.
- Privacy policy and terms published and linked.
- Eval harness and Playwright E2E pass.

Distributed rate limiting is already in place (Postgres-backed), so it does
not need a separate service before launch.

---

## Runbooks

### If an API key leaks

1. Rotate the key immediately. Supabase: Dashboard, Settings, API, reset the
   affected key. Gemini: delete the leaked key in AI Studio and create a new
   one.
2. Update `.env` and the production environment.
3. Redeploy so the new value is picked up, and verify.
4. Audit logs for activity during the exposure window.
5. Document the incident: when, how, blast radius, root cause.

### If you suspect unauthorized database access

1. Do not delete logs.
2. Query `usage_events` and the Supabase auth audit log for the suspect
   window; look for unusual access patterns.
3. If an attack is ongoing, rotate the service-role key, which invalidates any
   session using the stolen key.
4. RLS bounds normal access to the attacker's own rows; service-role access is
   unbounded, so treat a service-role leak as critical.
5. Follow breach notification below if user data was exposed.

### Breach notification

Under GDPR, personal-data breaches affecting EU residents must be reported to
the relevant supervisory authority within 72 hours of discovery, and affected
users must be told without undue delay if the breach is high risk. In practice:
document what happened, notify the authority if EU users are affected, email
affected users with guidance, and publish a postmortem.

### Restoring from backup

1. Supabase Dashboard, Database, Backups.
2. Restore the chosen snapshot. On Supabase this creates a new project, so
   update `.env` and the production environment with the new connection
   strings.
3. Test a restore at least once before launch so you know the process works.

### Deployment rollback

1. In the host dashboard, promote the previous successful deployment.
2. If the bad deploy ran a destructive migration, restore the database from
   the backup taken just before it.
3. Record the rollback so the next deploy does not repeat the issue.

---

## Vendor data processing agreements

Required for GDPR; each vendor publishes one. Review before going public;
nothing to do for personal or dev use.

| Vendor | DPA |
| --- | --- |
| Supabase | supabase.com/legal/dpa |
| Google (Gemini API) | cloud.google.com/terms/data-processing-addendum |
| Email provider (when configured) | per provider |

---

## Reporting a vulnerability

If you find a security issue, do not open a public issue. Email the maintainer
privately, or use the contact set up when the project goes public. Expect an
acknowledgement within 48 hours and a fix for critical issues within 7 days.

---

## Maintenance cadence

| Task | Cadence |
| --- | --- |
| `npm audit` review | weekly |
| Dependency upgrades | weekly |
| Eval harness run | every change and in CI |
| Backup restore drill | quarterly |
| Key rotation | annually, or immediately on suspected compromise |
| Security headers re-test | quarterly |
| RLS policy review | every migration via `scripts/verify-db.ts` |
