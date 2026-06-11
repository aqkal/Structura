import pino from "pino";

/**
 * Structured JSON logger to stdout. Deliberately no transports: plain JSON
 * lines are what log collectors expect, and pretty-printing belongs in the
 * dev terminal (pipe through pino-pretty), not in application code.
 *
 * The redact list is a backstop, not permission to log sensitive fields.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { app: "structura" },
  redact: {
    paths: [
      "email",
      "*.email",
      "user_metadata",
      "*.user_metadata",
      "authorization",
      "*.authorization",
      "apiKey",
      "*.apiKey",
      "problemText",
      "*.problemText",
      "responseText",
      "*.responseText",
      // Defense in depth: raw error text / stacks can carry DB schema
      // details or internal paths. We never log them on purpose; this
      // censors any that slip in via a future change.
      "error",
      "*.error",
      "message",
      "*.message",
      "stack",
      "*.stack",
    ],
    censor: "[redacted]",
  },
});

/**
 * Audit-style event logging.
 *
 * NEVER pass problem text, AI responses, or emails here. Only ids, counts,
 * kinds, status codes, and durations.
 */
export function logEvent(
  event: string,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  logger.info({ event, ...data });
}

/**
 * Classify an error for logging without leaking its message. Database and
 * provider error messages can carry table names, constraint names, or
 * internal paths, so we record only the error's class name (for example
 * "PostgresError"), never its text.
 */
export function errorName(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  return "UnknownError";
}
