/**
 * A pooled WebSocket can die while Vercel has the function frozen, or when Neon suspends an idle
 * compute; the next query then fails at the connection level with a bare `ErrorEvent`. Reads are
 * retried; writes are not, because a dropped connection can't tell us whether they committed.
 */

/** Waits before each retry: long enough for a compute to finish waking. */
export const RETRY_DELAYS_MS = [300, 1000] as const;

const CONNECTION_CODES = new Set([
  "57P01", // admin_shutdown: the compute was suspended under the connection
  "57P02", // crash_shutdown
  "57P03", // cannot_connect_now: still starting
  "08000",
  "08001",
  "08003",
  "08004",
  "08006",
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "EPIPE",
]);
const CONNECTION_MESSAGE =
  /connection terminated|connection error|websocket|socket hang up|server closed the connection/i;

/** True for failures of the connection itself, never for SQL errors (constraints, syntax…). */
export function isConnectionError(err: unknown): boolean {
  if (err === null || typeof err !== "object") return false;
  // The Neon driver rejects with the WebSocket's ErrorEvent, which isn't an Error.
  if (!(err instanceof Error)) return (err as { type?: unknown }).type === "error";
  const code = (err as { code?: unknown }).code;
  if (typeof code === "string" && CONNECTION_CODES.has(code)) return true;
  if (typeof code === "string") return false; // a real SQLSTATE: the server answered
  return CONNECTION_MESSAGE.test(err.message);
}

/** Only plain reads are safe to run twice. */
export function isRetryableRead(sqlText: unknown): boolean {
  return typeof sqlText === "string" && /^\s*select\b/i.test(sqlText);
}

/** Runs `run`, retrying a read after connection failures. `onRetry` is for logging. */
export async function withReadRetry<T>(
  sqlText: unknown,
  run: () => Promise<T>,
  opts: {
    sleep?: (ms: number) => Promise<void>;
    onRetry?: (attempt: number, err: unknown) => void;
  } = {},
): Promise<T> {
  const sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const delay = RETRY_DELAYS_MS[attempt];
      if (delay === undefined || !isRetryableRead(sqlText) || !isConnectionError(err)) throw err;
      opts.onRetry?.(attempt + 1, err);
      await sleep(delay);
    }
  }
}
