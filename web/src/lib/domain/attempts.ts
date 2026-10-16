import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  attempt,
  attemptItems,
  chunk,
  chunkExample,
  practiceSession,
  writingResult,
} from "@/db/schema";
import { MAX_AUDIO_BYTES, recordingMimeTypes, type ScoreResult } from "@/lib/contracts/scoring";
import { AppError } from "@/lib/errors";
import { scoringClient } from "@/lib/providers/scoring-client";
import { composeFeedback } from "./feedback";
import type { HintInput } from "./prompts";
import { setCountsTowardLimit, type SessionCtx } from "./session-engine";
import { recordUsage } from "./usage";

export const AttemptInput = z.object({
  step: z.enum(["speak_1", "speak_2", "read_aloud"]),
  item: z.enum(attemptItems),
  mimeType: z.enum(recordingMimeTypes),
});
export type AttemptInput = z.infer<typeof AttemptInput>;

export type AttemptResult =
  | {
      kind: "scored";
      score: number;
      components: { sounds: number; words: number; flow: number };
      weakestSounds: HintInput[];
      tip: string;
      improvement: number | null;
    }
  | { kind: "unusable"; reason: string };

const SPEAK_ITEMS = ["chunk", "example_1", "example_2", "example_3"] as const;
const READ_ITEMS = ["sentence_1", "sentence_2", "sentence_3"] as const;

async function expectedTextFor(sessionId: string, chunkId: string, item: AttemptInput["item"]) {
  const d = db();
  if (item === "chunk") {
    const [c] = await d.select({ text: chunk.text }).from(chunk).where(eq(chunk.id, chunkId));
    return c!.text;
  }
  if (item.startsWith("example_")) {
    const position = Number(item.slice(-1));
    const [e] = await d
      .select({ text: chunkExample.text })
      .from(chunkExample)
      .where(and(eq(chunkExample.chunkId, chunkId), eq(chunkExample.position, position)));
    return e!.text;
  }
  const position = Number(item.slice(-1));
  const [w] = await d
    .select({ text: writingResult.corrected })
    .from(writingResult)
    .where(and(eq(writingResult.sessionId, sessionId), eq(writingResult.position, position)))
    .orderBy(asc(writingResult.position));
  if (!w || w.text === "[removed]")
    throw new AppError("validation", "That sentence can't be read aloud.");
  return w.text;
}

/**
 * Scores one recording (FR-013, FR-017). The audio is forwarded in memory to the self-hosted
 * scoring service and then dropped — it is never stored or logged (FR-019, FR-020).
 */
export async function recordAttempt(
  ctx: SessionCtx,
  sessionId: string,
  input: AttemptInput,
  audio: Blob,
): Promise<AttemptResult> {
  if (audio.size === 0) throw new AppError("validation", "The recording is empty.");
  if (audio.size > MAX_AUDIO_BYTES)
    throw new AppError("validation", "That recording is too long. Keep it under 15 seconds.");

  const d = db();
  const [s] = await d
    .select()
    .from(practiceSession)
    .where(and(eq(practiceSession.id, sessionId), eq(practiceSession.userId, ctx.userId)));
  if (!s) throw new AppError("not_found", "Session not found.");
  if (s.step !== input.step) throw new AppError("conflict", "This step is already finished.");
  const allowed: readonly string[] = input.step === "read_aloud" ? READ_ITEMS : SPEAK_ITEMS;
  if (!allowed.includes(input.item))
    throw new AppError("validation", "Unknown item for this step.");

  const expectedText = await expectedTextFor(s.id, s.chunkId, input.item);

  let outcome;
  try {
    outcome = await scoringClient.score({
      audio,
      mimeType: input.mimeType,
      expectedText,
      level: ctx.level,
    });
  } catch (err) {
    // Keep the session; if the learner gives up now, this practice won't use today's limit.
    if (err instanceof AppError && err.code === "unavailable")
      await setCountsTowardLimit(s.id, false);
    throw err;
  }
  await recordUsage("scoring_requests", 1).catch(() => undefined);
  if (outcome.kind === "unusable") return { kind: "unusable", reason: outcome.reason };
  if (!s.countsTowardLimit) await setCountsTowardLimit(s.id, true);

  const r: ScoreResult = outcome.result;
  let previousScore: number | undefined;
  if (input.step === "speak_2") {
    const [prev] = await d
      .select({ score: attempt.score })
      .from(attempt)
      .where(
        and(eq(attempt.sessionId, s.id), eq(attempt.step, "speak_1"), eq(attempt.item, input.item)),
      );
    previousScore = prev?.score;
  }
  const fb = await composeFeedback({
    level: ctx.level,
    itemText: expectedText,
    score: r.score,
    weakestSounds: r.weakest_sounds,
    previousScore,
  });

  const values = {
    sessionId: s.id,
    step: input.step,
    item: input.item,
    expectedText,
    score: r.score,
    wordAccuracy: r.components.word_accuracy,
    phonemeAccuracy: r.components.phoneme_accuracy,
    fluency: r.components.fluency,
    soundResults: r.sounds,
    weakestSounds: r.weakest_sounds.slice(0, 3),
    tip: fb.tip,
    hintTableVersion: fb.hintTableVersion,
  };
  // Re-recording while the step is current ("Try again") replaces the item's score.
  await d
    .insert(attempt)
    .values(values)
    .onConflictDoUpdate({ target: [attempt.sessionId, attempt.step, attempt.item], set: values });

  return {
    kind: "scored",
    score: r.score,
    components: {
      sounds: r.components.phoneme_accuracy,
      words: r.components.word_accuracy,
      flow: r.components.fluency,
    },
    weakestSounds: fb.hints,
    tip: fb.tip,
    improvement: previousScore === undefined ? null : r.score - previousScore,
  };
}
