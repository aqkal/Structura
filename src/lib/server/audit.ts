import pino from "pino";

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

export function logEvent(
  event: string,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  logger.info({ event, ...data });
}

export function errorName(err: unknown): string {
  if (err instanceof Error) return err.name || "Error";
  return "UnknownError";
}
