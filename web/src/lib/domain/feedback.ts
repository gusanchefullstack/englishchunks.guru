import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { soundHint, type CefrLevel } from "@/db/schema";
import { PronunciationTip } from "@/lib/contracts/llm";
import { AppError } from "@/lib/errors";
import { llm } from "@/lib/providers/llm";
import { checkTip } from "./feedback-guards";
import { buildTipPrompt, type HintInput } from "./prompts";

export type ComposedFeedback = { tip: string; hints: HintInput[]; hintTableVersion: number };

/** FR-014: the curated hints for the weakest sounds (deterministic, no LLM). */
export async function lookupHints(
  weakestSounds: string[],
): Promise<{ hints: HintInput[]; hintTableVersion: number }> {
  const rows = weakestSounds.length
    ? await db().select().from(soundHint).where(inArray(soundHint.ipaSymbol, weakestSounds))
    : [];
  const hints: HintInput[] = weakestSounds.flatMap((ipa) => {
    const r = rows.find((x) => x.ipaSymbol === ipa);
    return r ? [{ ipa: r.ipaSymbol, hint: r.hint, exampleWords: r.exampleWords }] : [];
  });
  return { hints, hintTableVersion: rows[0]?.version ?? 1 };
}

/** Plain message used until (or instead of) the LLM tip. */
export function fallbackTip(hints: HintInput[]) {
  return hints.length
    ? "Nice try! Focus on the sounds below, then try again."
    : "Nice try! Listen once more, then say it again slowly.";
}

/**
 * The short warm message around the fixed hints. If the LLM is unavailable the learner still
 * gets the fixed hints with a plain message.
 */
export async function writeTip(args: {
  level: CefrLevel;
  itemText: string;
  score: number;
  hints: HintInput[];
  previousScore?: number;
}): Promise<string> {
  const allowedNumbers = [
    String(args.score),
    ...(args.previousScore !== undefined ? [String(args.previousScore)] : []),
  ];
  try {
    const { message } = await llm.generate({
      role: "feedback",
      schema: PronunciationTip,
      ...buildTipPrompt(args),
      check: (v) => checkTip(v.message, { allowedNumbers }),
    });
    return message;
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    return fallbackTip(args.hints);
  }
}

/** FR-014: fixed hints for the weakest sounds wrapped in a short warm message. */
export async function composeFeedback(args: {
  level: CefrLevel;
  itemText: string;
  score: number;
  weakestSounds: string[];
  previousScore?: number;
}): Promise<ComposedFeedback> {
  const { hints, hintTableVersion } = await lookupHints(args.weakestSounds);
  const tip = await writeTip({ ...args, hints });
  return { tip, hints, hintTableVersion };
}
