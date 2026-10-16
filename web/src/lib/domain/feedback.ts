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

/**
 * FR-014: fixed hints from the curated table for the weakest sounds, wrapped in a short warm
 * message. If the LLM is unavailable the learner still gets the fixed hints with a plain message.
 */
export async function composeFeedback(args: {
  level: CefrLevel;
  itemText: string;
  score: number;
  weakestSounds: string[];
  previousScore?: number;
}): Promise<ComposedFeedback> {
  const rows = args.weakestSounds.length
    ? await db().select().from(soundHint).where(inArray(soundHint.ipaSymbol, args.weakestSounds))
    : [];
  const hints: HintInput[] = args.weakestSounds.flatMap((ipa) => {
    const r = rows.find((x) => x.ipaSymbol === ipa);
    return r ? [{ ipa: r.ipaSymbol, hint: r.hint, exampleWords: r.exampleWords }] : [];
  });
  const hintTableVersion = rows[0]?.version ?? 1;
  const allowedNumbers = [
    String(args.score),
    ...(args.previousScore !== undefined ? [String(args.previousScore)] : []),
  ];
  try {
    const { message } = await llm.generate({
      role: "feedback",
      schema: PronunciationTip,
      ...buildTipPrompt({ ...args, hints }),
      check: (v) => checkTip(v.message, { allowedNumbers }),
    });
    return { tip: message, hints, hintTableVersion };
  } catch (err) {
    if (!(err instanceof AppError)) throw err;
    const fallback = hints.length
      ? "Nice try! Focus on the sounds below, then try again."
      : "Nice try! Listen once more, then say it again slowly.";
    return { tip: fallback, hints, hintTableVersion };
  }
}
