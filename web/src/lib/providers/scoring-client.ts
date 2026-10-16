import "server-only";
import { createHmac, randomUUID } from "node:crypto";
import type { CefrLevel } from "@/db/schema";
import {
  PhonemizeResult,
  ScoreResult,
  Unusable,
  type RecordingMimeType,
} from "@/lib/contracts/scoring";
import { e2eMode } from "@/lib/e2e";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type ScoreOutcome =
  { kind: "scored"; result: ScoreResult } | { kind: "unusable"; reason: Unusable["reason"] };

export function signRequest(secret: string, timestamp: number, requestId: string) {
  const mac = createHmac("sha256", secret).update(`${timestamp}.${requestId}`).digest("hex");
  return `sha256=${mac}`;
}

function authHeaders(requestId: string): Record<string, string> {
  const ts = Math.floor(Date.now() / 1000);
  return {
    "X-Timestamp": String(ts),
    "X-Request-Id": requestId,
    "X-Signature": signRequest(env().SCORING_SHARED_SECRET, ts, requestId),
  };
}

const TIMEOUT_MS = 20_000;

/**
 * Client for the self-hosted scoring service. Audio is passed through in memory only and is
 * never logged or persisted (FR-019, FR-020).
 */
export const scoringClient = {
  async score(input: {
    audio: Blob;
    mimeType: RecordingMimeType;
    expectedText: string;
    level: CefrLevel;
    requestId?: string;
  }): Promise<ScoreOutcome> {
    if (e2eMode()) return fakeScore(input.expectedText, input.audio.size);
    const requestId = input.requestId ?? randomUUID();
    const form = new FormData();
    form.set("audio", input.audio, "recording");
    form.set("mime_type", input.mimeType);
    form.set("expected_text", input.expectedText);
    form.set("level", input.level);

    let res: Response;
    try {
      res = await fetch(`${env().SCORING_URL}/v1/score`, {
        method: "POST",
        headers: authHeaders(requestId),
        body: form,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      logger.warn({ requestId, err: (err as Error).name }, "scoring unreachable");
      throw new AppError("unavailable", "Scoring is busy right now. Please try again.");
    }

    if (res.status === 200) return { kind: "scored", result: ScoreResult.parse(await res.json()) };
    if (res.status === 422)
      return { kind: "unusable", reason: Unusable.parse(await res.json()).reason };
    if (res.status === 413)
      throw new AppError("validation", "That recording is too long. Keep it under 15 seconds.");
    logger.warn({ requestId, status: res.status }, "scoring error");
    throw new AppError("unavailable", "Scoring is busy right now. Please try again.");
  },

  /** Deterministic American-English IPA via espeak-ng (never an LLM — Principle II). */
  async phonemize(texts: string[]): Promise<string[]> {
    if (e2eMode()) return texts.map((t) => t.toLowerCase());
    const requestId = randomUUID();
    const res = await fetch(`${env().SCORING_URL}/v1/phonemize`, {
      method: "POST",
      headers: { ...authHeaders(requestId), "Content-Type": "application/json" },
      body: JSON.stringify({ texts }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    }).catch(() => null);
    if (!res?.ok) throw new AppError("unavailable", "Could not compute pronunciation right now.");
    const { ipa } = PhonemizeResult.parse(await res.json());
    if (ipa.length !== texts.length)
      throw new AppError("unavailable", "Pronunciation service mismatch.");
    return ipa;
  },
};

/** Deterministic E2E scoring: higher on later tries so improvement is visible. */
function fakeScore(expectedText: string, bytes: number): ScoreOutcome {
  const score = 60 + ((expectedText.length + Math.floor(bytes / 1000)) % 35);
  return {
    kind: "scored",
    result: {
      score,
      components: {
        phoneme_accuracy: score,
        word_accuracy: Math.min(100, score + 8),
        fluency: Math.max(0, score - 4),
      },
      sounds: [
        { ipa: "ð", score: score - 20, count: 2 },
        { ipa: "s", score: score - 10, count: 3 },
      ],
      weakest_sounds: ["ð", "s"],
      transcript: expectedText.toLowerCase(),
      model_versions: { scoring: "e2e-fake" },
    },
  };
}
