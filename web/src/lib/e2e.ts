/**
 * E2E mode swaps external providers (LLM, TTS, storage, email, scoring) for deterministic
 * in-process fakes so end-to-end tests run offline (constitution III). It can never be
 * enabled in a production build.
 */
export function e2eMode(): boolean {
  return process.env.E2E === "1" && process.env.NODE_ENV !== "production";
}

type OutboxEmail = { to: string; subject: string; text: string; at: string };

/** E2E email outbox (globalThis so every route bundle in the dev server shares it). */
export function e2eOutbox(): OutboxEmail[] {
  const g = globalThis as unknown as { __e2eOutbox?: OutboxEmail[] };
  g.__e2eOutbox ??= [];
  return g.__e2eOutbox;
}
