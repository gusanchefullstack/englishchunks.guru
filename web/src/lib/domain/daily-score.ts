import type { ScoreWeights } from "@/db/schema";
import { daysBetween } from "./time";

export type StepScores = { speaking: number | null; writing: number | null; readAloud: number | null };

/** Daily score (FR-018): weighted over completed steps; any skipped step marks it partial. */
export function computeDailyScore(scores: StepScores, weights: ScoreWeights) {
  const parts: [number | null, number][] = [
    [scores.speaking, weights.speaking],
    [scores.writing, weights.writing],
    [scores.readAloud, weights.read_aloud],
  ];
  const done = parts.filter((p): p is [number, number] => p[0] !== null);
  const partial = done.length < parts.length;
  const weightSum = done.reduce((s, [, w]) => s + w, 0);
  if (!weightSum) return { score: 0, partial: true };
  const score = done.reduce((s, [v, w]) => s + v * w, 0) / weightSum;
  return { score: Math.max(0, Math.min(100, Math.round(score))), partial };
}

export type StreakState = { current: number; longest: number; lastPracticeDate: string | null };

/** Streak after completing a practice on `practiceDate` (the session's local start date). */
export function nextStreak(s: StreakState, practiceDate: string) {
  let current: number;
  if (!s.lastPracticeDate) current = 1;
  else {
    const gap = daysBetween(s.lastPracticeDate, practiceDate);
    current = gap <= 0 ? s.current || 1 : gap === 1 ? s.current + 1 : 1;
  }
  return { current, longest: Math.max(s.longest, current) };
}

export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
