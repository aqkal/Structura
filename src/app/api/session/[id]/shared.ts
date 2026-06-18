import { NextResponse, type NextRequest } from "next/server";
import type { z } from "zod";

import { apiError } from "@/lib/server/api-error";
import { checkDailyBudget } from "@/lib/server/usage";

export type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T>(
  req: NextRequest,
  validator: z.ZodType<T>,
): Promise<ParsedBody<T>> {
  const raw: unknown = await req.json().catch(() => null);
  const parsed = validator.safeParse(raw);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body.";
    return { ok: false, response: apiError(400, "bad_request", message) };
  }
  return { ok: true, data: parsed.data };
}

export function aiBudgetHeaders(
  used: number,
  budget: number,
): Record<string, string> {
  return {
    "x-ai-used": String(used),
    "x-ai-budget": String(budget),
  };
}

export type BudgetGateResult = {
  blocked: NextResponse | null;
  used: number;
  budget: number;
};

export async function budgetGate(userId: string): Promise<BudgetGateResult> {
  const { allowed, used, budget } = await checkDailyBudget(userId);
  if (!allowed) {
    const response = apiError(
      429,
      "budget_exceeded",
      "You have used today's AI budget. It resets at midnight UTC.",
    );
    for (const [name, value] of Object.entries(aiBudgetHeaders(used, budget))) {
      response.headers.set(name, value);
    }
    return { blocked: response, used, budget };
  }
  return { blocked: null, used, budget };
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 });
}
