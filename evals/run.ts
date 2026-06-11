/**
 * In-house eval harness for the Structura prompts.
 *
 * Runs each case in `evals/cases/*.json` through the real AI provider layer
 * (src/lib/server/ai), then checks the response against assertions. Two kinds:
 *
 *   - Deterministic (free, fast): substring / regex / sentence-count checks
 *   - LLM-as-judge (small cost): a second model call returns yes/no on a rubric
 *
 * Run with: `npm run eval`
 * Exits non-zero on any failure. Wire this into CI to catch prompt regressions.
 *
 * Cases run SEQUENTIALLY, and judge calls within a case run sequentially too,
 * because the free-tier Gemini quota is rate limited.
 */

import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  generateFeedback,
  generateHint,
  generateScaffold,
  judge,
  type ScaffoldContext,
  type StepHistoryItem,
} from "../src/lib/server/ai";

/* ------------------------------------------------------------------
   Case and assertion shapes
   ------------------------------------------------------------------ */

type Assertion =
  | { type: "max_sentences"; value: number }
  | { type: "must_contain"; value: string }
  | { type: "must_not_contain"; value: string }
  | { type: "must_contain_ci"; value: string }
  | { type: "must_not_contain_ci"; value: string }
  | { type: "match_regex"; value: string }
  | { type: "judge"; rubric: string; expect: "yes" | "no" };

type Case = {
  name: string;
  kind: "scaffold" | "feedback" | "hint";
  problem: string;
  subject: string;
  scaffoldMode?: "guided" | "questions_only" | "with_examples";
  stepNum: number;
  totalSteps?: number;
  history?: StepHistoryItem[];
  userResponse?: string;
  draft?: string | null;
  assertions: Assertion[];
};

/* ------------------------------------------------------------------
   Rate-limit aware call wrapper.

   Free-tier Gemini quotas can be as low as 5 requests per minute, so:
   - every API call waits until at least EVAL_DELAY_MS since the last one
   - quota errors wait out the window and retry a couple of times
   ------------------------------------------------------------------ */

const CALL_DELAY_MS = Number(process.env.EVAL_DELAY_MS ?? 13000);
let lastCallAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    const wait = lastCallAt + CALL_DELAY_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
    try {
      return await fn();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isQuota = /quota|rate limit|429/i.test(message);
      if (!isQuota || attempt >= 3) throw err;
      const hinted = /retry in ([\d.]+)s/i.exec(message);
      const waitMs = hinted ? Number(hinted[1]) * 1000 + 2000 : 35000;
      process.stdout.write(
        `\n    (quota hit, waiting ${Math.round(waitMs / 1000)}s) `,
      );
      await sleep(waitMs);
    }
  }
}

/* ------------------------------------------------------------------
   Wiring to the real provider layer
   ------------------------------------------------------------------ */

async function runPrompt(c: Case): Promise<string> {
  const ctx: ScaffoldContext = {
    problem: c.problem,
    subject: c.subject,
    scaffoldMode: c.scaffoldMode ?? "guided",
    stepNum: c.stepNum,
    totalSteps: c.totalSteps ?? 5,
    history: c.history ?? [],
  };
  switch (c.kind) {
    case "scaffold":
      return throttled(() => generateScaffold(ctx));
    case "feedback":
      return throttled(() => generateFeedback(ctx, c.userResponse ?? ""));
    case "hint":
      return throttled(() => generateHint(ctx, c.draft ?? null));
  }
}

/* ------------------------------------------------------------------
   Assertion engine
   ------------------------------------------------------------------ */

async function evalAssertion(
  response: string,
  a: Assertion,
): Promise<{ pass: boolean; reason?: string }> {
  switch (a.type) {
    case "max_sentences": {
      const count = response.split(/[.!?]+\s/).filter(Boolean).length;
      return count <= a.value
        ? { pass: true }
        : {
            pass: false,
            reason: `expected <=${a.value} sentences, got ${count}`,
          };
    }
    case "must_contain":
      return response.includes(a.value)
        ? { pass: true }
        : { pass: false, reason: `missing substring: "${a.value}"` };
    case "must_not_contain":
      return !response.includes(a.value)
        ? { pass: true }
        : { pass: false, reason: `forbidden substring present: "${a.value}"` };
    case "must_contain_ci":
      return response.toLowerCase().includes(a.value.toLowerCase())
        ? { pass: true }
        : { pass: false, reason: `missing substring (ci): "${a.value}"` };
    case "must_not_contain_ci":
      return !response.toLowerCase().includes(a.value.toLowerCase())
        ? { pass: true }
        : {
            pass: false,
            reason: `forbidden substring present (ci): "${a.value}"`,
          };
    case "match_regex":
      return new RegExp(a.value).test(response)
        ? { pass: true }
        : { pass: false, reason: `regex did not match: ${a.value}` };
    case "judge": {
      const verdict = await throttled(() => judge(response, a.rubric));
      return verdict === a.expect
        ? { pass: true }
        : {
            pass: false,
            reason: `judge said "${verdict}", expected "${a.expect}" (rubric: ${a.rubric})`,
          };
    }
  }
}

/* ------------------------------------------------------------------
   Runner
   ------------------------------------------------------------------ */

function truncate(text: string, max = 240): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length <= max ? flat : `${flat.slice(0, max)}...`;
}

async function main() {
  const casesDir = join(process.cwd(), "evals", "cases");
  const files = readdirSync(casesDir).filter((f) => f.endsWith(".json"));
  const cases: Case[] = files.flatMap(
    (f) => JSON.parse(readFileSync(join(casesDir, f), "utf8")) as Case[],
  );

  let passed = 0;
  let failed = 0;

  // Sequential on purpose: free-tier rate limits punish parallel calls.
  for (const c of cases) {
    process.stdout.write(`- ${c.name} ... `);
    try {
      const response = await runPrompt(c);
      const fails: string[] = [];
      for (const a of c.assertions) {
        const result = await evalAssertion(response, a);
        if (!result.pass) fails.push(result.reason ?? "assertion failed");
      }
      if (fails.length === 0) {
        process.stdout.write("\x1b[32mPASS\x1b[0m\n");
        passed++;
      } else {
        process.stdout.write("\x1b[31mFAIL\x1b[0m\n");
        for (const reason of fails) process.stdout.write(`    - ${reason}\n`);
        process.stdout.write(`    response: ${truncate(response)}\n`);
        failed++;
      }
    } catch (err) {
      process.stdout.write("\x1b[31mERROR\x1b[0m\n");
      process.stdout.write(
        `    ${err instanceof Error ? err.message : String(err)}\n`,
      );
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed (${cases.length} total)`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
