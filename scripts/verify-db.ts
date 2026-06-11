/**
 * One-off DB sanity check.
 * Run: `npx tsx scripts/verify-db.ts`
 *
 * Confirms that:
 *   - All 9 expected tables exist
 *   - RLS is enabled on each
 *   - Each table has the expected number of policies
 *   - The auth.users → public.users trigger is installed
 *   - Subjects are seeded
 */
import "dotenv/config";
import postgres from "postgres";

const expectedTables = [
  "users",
  "subjects",
  "sessions",
  "steps",
  "hints",
  "confidence_ratings",
  "retrospectives",
  "portfolio_pins",
  "scheduled_tasks",
  "usage_events",
  "chats",
  "chat_messages",
  "chat_attachments",
];

const expectedPolicyCount: Record<string, number> = {
  users: 2,
  subjects: 1,
  sessions: 1,
  steps: 1,
  hints: 1,
  confidence_ratings: 1,
  retrospectives: 1,
  portfolio_pins: 2,
  scheduled_tasks: 1,
  usage_events: 1,
  chats: 1,
  chat_messages: 1,
  chat_attachments: 1,
};

const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "", {
  prepare: false,
  max: 1,
});

const ok = (msg: string) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const fail = (msg: string) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);

async function main() {
  let failures = 0;

  console.log("\n▸ Tables");
  const tables = await sql<{ table_name: string; rls: boolean }[]>`
    select c.relname as table_name, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `;
  const tableMap = new Map(tables.map((t) => [t.table_name, t.rls]));

  for (const name of expectedTables) {
    if (!tableMap.has(name)) {
      fail(`table missing: ${name}`);
      failures++;
    } else if (!tableMap.get(name)) {
      fail(`table ${name}: RLS NOT enabled`);
      failures++;
    } else {
      ok(`${name} (RLS on)`);
    }
  }

  console.log("\n▸ Policies");
  const policies = await sql<{ tablename: string; policyname: string }[]>`
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `;
  const policyCounts = policies.reduce<Record<string, number>>((acc, p) => {
    acc[p.tablename] = (acc[p.tablename] ?? 0) + 1;
    return acc;
  }, {});

  for (const [name, expected] of Object.entries(expectedPolicyCount)) {
    const got = policyCounts[name] ?? 0;
    if (got >= expected) {
      ok(`${name}: ${got} polic${got === 1 ? "y" : "ies"}`);
    } else {
      fail(`${name}: expected ≥${expected}, got ${got}`);
      failures++;
    }
  }

  console.log("\n▸ Auth trigger");
  const triggers = await sql<{ tgname: string }[]>`
    select tgname
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'auth' and c.relname = 'users'
      and t.tgname = 'on_auth_user_created'
  `;
  if (triggers.length === 1) {
    ok("on_auth_user_created trigger installed on auth.users");
  } else {
    fail("on_auth_user_created trigger NOT installed");
    failures++;
  }

  console.log("\n▸ Seed data");
  const subjects = await sql<{ slug: string; label: string }[]>`
    select slug, label from public.subjects order by sort_order
  `;
  if (subjects.length >= 6) {
    ok(
      `${subjects.length} subjects seeded: ${subjects.map((s) => s.slug).join(", ")}`,
    );
  } else {
    fail(`expected ≥6 subjects, got ${subjects.length}`);
    failures++;
  }

  console.log("\n▸ Schema enums");
  const enums = await sql<{ typname: string }[]>`
    select typname from pg_type
    where typtype = 'e' and typname in (
      'scaffold_mode','session_status','confidence_point',
      'scheduled_task_kind','scheduled_task_status','usage_kind','chat_role'
    )
    order by typname
  `;
  if (enums.length === 7) {
    ok(`all 7 enums present`);
  } else {
    fail(
      `expected 7 enums, got ${enums.length}: ${enums.map((e) => e.typname).join(", ")}`,
    );
    failures++;
  }

  await sql.end();

  console.log(
    failures === 0
      ? "\n\x1b[32mAll checks passed.\x1b[0m\n"
      : `\n\x1b[31m${failures} check(s) failed.\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
