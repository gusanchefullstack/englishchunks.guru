import type { AttemptResult as ServerAttemptResult } from "@/lib/domain/attempts";
import type { getSession } from "@/lib/domain/session-engine";

export type SessionView = Awaited<ReturnType<typeof getSession>>;
export type Attempt = SessionView["attempts"][number];
export type Writing = SessionView["writing"][number];
/** On the client the score can arrive before Mina's tip (streamed): tip is null meanwhile. */
export type Scored = Omit<Extract<ServerAttemptResult, { kind: "scored" }>, "tip"> & {
  tip: string | null;
};
export type AttemptResult = Scored | Extract<ServerAttemptResult, { kind: "unusable" }>;

export const SPEAK_ITEMS = ["chunk", "example_1", "example_2", "example_3"] as const;
export const READ_ITEMS = ["sentence_1", "sentence_2", "sentence_3"] as const;

export const TYPE_LABELS: Record<string, string> = {
  collocation: "Collocation",
  idiom: "Idiom",
  polyword: "Social phrase",
  vague_language: "Vague language",
  sentence_frame: "Sentence frame",
  verb_pattern: "Verb pattern",
  discourse_marker: "Discourse marker",
};

export function scoreLabel(score: number) {
  if (score >= 90) return { title: "Excellent!", line: "That sounded natural and clear." };
  if (score >= 75) return { title: "A strong try!", line: "Clear and easy to understand." };
  if (score >= 55)
    return { title: "Good effort!", line: "You're close — the tip below will help." };
  return { title: "Keep going!", line: "Listen once more and copy the rhythm." };
}
