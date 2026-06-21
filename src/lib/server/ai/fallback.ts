import {
  DEFAULT_CHAT_MODEL,
  isChatModelId,
  type ChatModelId,
} from "./provider";

const FALLBACK_MODELS: ChatModelId[] = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-2.5-pro",
];

export function fallbackChain(startId: string): string[] {
  const start = isChatModelId(startId) ? startId : DEFAULT_CHAT_MODEL;
  return [start, ...FALLBACK_MODELS.filter((m) => m !== start)];
}

export function isRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as {
    statusCode?: number;
    status?: number;
    message?: string;
    responseBody?: string;
    cause?: unknown;
  };
  if (e.statusCode === 429 || e.status === 429) return true;
  const haystack = `${e.message ?? ""} ${e.responseBody ?? ""}`.toUpperCase();
  if (
    haystack.includes("RESOURCE_EXHAUSTED") ||
    haystack.includes("TOO MANY REQUESTS") ||
    haystack.includes("RATE LIMIT") ||
    haystack.includes("QUOTA")
  ) {
    return true;
  }
  if (e.cause && e.cause !== err) return isRateLimitError(e.cause);
  return false;
}

export async function withModelFallback<R>(
  startId: string,
  attempt: (modelId: string) => Promise<R>,
): Promise<{ result: R; modelUsed: string; switched: boolean }> {
  const chain = fallbackChain(startId);
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    try {
      const result = await attempt(chain[i]);
      return { result, modelUsed: chain[i], switched: i > 0 };
    } catch (err) {
      lastErr = err;
      if (isRateLimitError(err) && i < chain.length - 1) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All models failed");
}

// Streaming fallback: a rate-limited model rejects before any tokens, so we
// read the first chunk to decide whether the chosen model took. If it did, we
// replay that chunk and pipe the rest; if it rate-limited, we try the next.
export async function streamWithFallback(
  startId: string,
  build: (modelId: string) => { textStream: ReadableStream<string> },
): Promise<{
  stream: ReadableStream<string>;
  modelUsed: string;
  switched: boolean;
}> {
  const chain = fallbackChain(startId);
  let lastErr: unknown;
  for (let i = 0; i < chain.length; i++) {
    const reader = build(chain[i]).textStream.getReader();
    try {
      const first = await reader.read();
      const stream = new ReadableStream<string>({
        start(controller) {
          if (first.done) controller.close();
          else controller.enqueue(first.value);
        },
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) controller.close();
            else controller.enqueue(value);
          } catch (err) {
            controller.error(err);
          }
        },
        cancel(reason) {
          void reader.cancel(reason);
        },
      });
      return { stream, modelUsed: chain[i], switched: i > 0 };
    } catch (err) {
      lastErr = err;
      try {
        await reader.cancel();
      } catch {}
      if (isRateLimitError(err) && i < chain.length - 1) continue;
      throw err;
    }
  }
  throw lastErr ?? new Error("All models failed");
}
