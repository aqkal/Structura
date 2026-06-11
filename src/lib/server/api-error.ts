import { NextResponse } from "next/server";

/** Fallback copy for common error codes when no message is supplied. */
const DEFAULT_MESSAGES: Record<string, string> = {
  unauthorized: "You must be signed in to do that.",
  not_found: "Resource not found.",
  rate_limited: "Too many requests. Please slow down and try again.",
  bad_request: "Invalid request.",
};

/**
 * Uniform JSON error response: { error: { code, message } }.
 *
 * In production, 5xx messages are replaced with a generic string so we
 * never leak stack traces or internal details to clients.
 */
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
