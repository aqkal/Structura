import { errorName, logEvent } from "@/lib/server/audit";

export function aiBudgetHeaders(
  used: number,
  budget: number,
): Record<string, string> {
  return {
    "x-ai-used": String(used),
    "x-ai-budget": String(budget),
  };
}

export function persistPartialReplyOnAbort(opts: {
  textStream: ReadableStream<string>;

  signal: AbortSignal;

  route: string;
  chatId: string;

  finished: () => boolean;

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
