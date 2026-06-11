import { errorName, logEvent } from "@/lib/server/audit";

/**
 * Shared, non-route helpers for the chat API handlers. This file is
 * colocated with the routes but is not itself a route (no HTTP exports).
 */

/**
 * AI budget headers attached to streaming chat responses so the client
 * can show a remaining-calls meter. `used` should already count the
 * call the route reserved for this reply (checkDailyBudget().used + 1).
 */
export function aiBudgetHeaders(
  used: number,
  budget: number,
): Record<string, string> {
  return {
    "x-ai-used": String(used),
    "x-ai-budget": String(budget),
  };
}

/**
 * Persist the partial assistant reply when the request is aborted.
 *
 * The AI SDK only fires onFinish when the model stream runs to
 * completion. When the student presses Stop, the client keeps the
 * partial text it has received and marks the message done, but the
 * HTTP stream is cancelled, onFinish never runs, and the server would
 * persist nothing: the two sides would disagree on the next load.
 *
 * Draining a teed copy of the text stream here keeps the pipeline
 * pulling to its end even after the client disconnects (the request
 * signal aborts the upstream model call, so this ends promptly). When
 * the stream ended because of an abort rather than a normal finish,
 * the accumulated partial text is handed to `persist` so the server
 * stores exactly what the client kept.
 */
export function persistPartialReplyOnAbort(opts: {
  /** A teed copy of the reply stream (result.textStream). */
  textStream: ReadableStream<string>;
  /** The request signal; partial text is persisted only on abort. */
  signal: AbortSignal;
  /** Route tag for audit logging, e.g. "chat-message". */
  route: string;
  chatId: string;
  /** Whether the route's onFinish persistence already ran. */
  finished: () => boolean;
  /** Persists the partial assistant text (non-empty, abort case only). */
  persist: (partialText: string) => Promise<void>;
}): void {
  void (async () => {
    let partial = "";
    try {
      const reader = opts.textStream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        partial += value;
      }
    } catch {
      // The stream errored before finishing; the request surface
      // reports that to the client. Nothing trustworthy to persist.
      return;
    }

    if (opts.finished() || !opts.signal.aborted || partial.length === 0) {
      return;
    }

    try {
      await opts.persist(partial);
      logEvent("chat_reply_aborted", {
        route: opts.route,
        chatId: opts.chatId,
        chars: partial.length,
      });
    } catch (err) {
      logEvent("persist_failed", {
        route: opts.route,
        chatId: opts.chatId,
        errorName: errorName(err),
      });
    }
  })();
}
