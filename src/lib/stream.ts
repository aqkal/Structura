/**
 * Client-safe fetch streaming helper.
 *
 * Posts JSON (or nothing) to an API route, reads the streamed text body
 * chunk by chunk, and reports the accumulated text on every chunk so the
 * caller can render it live.
 *
 * Supports an optional idle timeout: if no bytes arrive for
 * `idleTimeoutMs`, the request is aborted and `StreamTimeoutError` is
 * thrown so callers can show an in-place retry instead of hanging forever.
 * A caller-initiated abort (the user pressing Stop) still surfaces as a
 * regular AbortError.
 */

export class StreamTimeoutError extends Error {
  constructor() {
    super("That took too long. Please try again.");
    this.name = "StreamTimeoutError";
  }
}

export type StreamPostOptions = {
  /** Abort if no bytes arrive for this many milliseconds. */
  idleTimeoutMs?: number;
  /** Called as soon as response headers are available, before streaming. */
  onHeaders?: (headers: Headers) => void;
};

export async function streamPost(
  url: string,
  body: unknown | undefined,
  onDelta: (fullText: string) => void,
  signal?: AbortSignal,
  opts?: StreamPostOptions,
): Promise<{ text: string; headers: Headers }> {
  const idleMs = opts?.idleTimeoutMs;
  const controller = idleMs ? new AbortController() : null;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const armTimer = () => {
    if (!controller || !idleMs) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, idleMs);
  };

  // Chain the caller's signal into the internal controller (AbortSignal.any
  // is too new for the supported browser floor).
  const onCallerAbort = () => controller?.abort();
  if (controller && signal) {
    if (signal.aborted) controller.abort();
    else signal.addEventListener("abort", onCallerAbort, { once: true });
  }

  armTimer();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller ? controller.signal : signal,
    });

    if (!res.ok) {
      let message = "Something went wrong. Please try again.";
      try {
        const data = (await res.json()) as { error?: { message?: string } };
        if (data?.error?.message) message = data.error.message;
      } catch {
        // Non-JSON error body, keep the generic message.
      }
      throw new Error(message);
    }

    opts?.onHeaders?.(res.headers);

    let text = "";
    const reader = res.body?.getReader();
    if (reader) {
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        armTimer();
        text += decoder.decode(value, { stream: true });
        onDelta(text);
      }
      const tail = decoder.decode();
      if (tail) {
        text += tail;
        onDelta(text);
      }
    }

    return { text, headers: res.headers };
  } catch (err) {
    if (timedOut) throw new StreamTimeoutError();
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
    if (signal) signal.removeEventListener("abort", onCallerAbort);
  }
}
