import { NextResponse } from "next/server";

const DEFAULT_MESSAGES: Record<string, string> = {
  unauthorized: "You must be signed in to do that.",
  not_found: "Resource not found.",
  rate_limited: "Too many requests. Please slow down and try again.",
  bad_request: "Invalid request.",
};

export function apiError(
  status: number,
  code: string,
  message?: string,
  init?: { retryAfterSeconds?: number },
): NextResponse {
  let resolved = message ?? DEFAULT_MESSAGES[code] ?? "Request failed.";

  if (status >= 500 && process.env.NODE_ENV === "production") {
    resolved = "Something went wrong.";
  }

  const headers = new Headers();
  if (init?.retryAfterSeconds !== undefined) {
    headers.set("Retry-After", String(init.retryAfterSeconds));
  }

  return NextResponse.json(
    { error: { code, message: resolved } },
    { status, headers },
  );
}
