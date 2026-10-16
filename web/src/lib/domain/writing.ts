import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chunk, practiceSession, writingResult } from "@/db/schema";
import { WritingFeedback } from "@/lib/contracts/llm";
import { AppError } from "@/lib/errors";
import { llm } from "@/lib/providers/llm";
import { checkWriting } from "./feedback-guards";
import { buildWritingPrompt } from "./prompts";
import type { SessionCtx } from "./session-engine";

export const REMOVED = "[removed]";

/** FR-016 / FR-016a: grade three learner sentences; offensive text is never stored. */
export async function submitWriting(
  ctx: SessionCtx,
  sessionId: string,
  sentences: [string, string, string],
) {
  const d = db();
  const [s] = await d
    .select()
    .from(practiceSession)
    .where(and(eq(practiceSession.id, sessionId), eq(practiceSession.userId, ctx.userId)));
  if (!s) throw new AppError("not_found", "Session not found.");
  if (s.step !== "write") throw new AppError("conflict", "This isn't the writing step.");
  const [c] = await d.select().from(chunk).where(eq(chunk.id, s.chunkId));

  const graded = await Promise.all(
    sentences.map((sentence) =>
      llm.generate({
        role: "feedback",
        schema: WritingFeedback,
        ...buildWritingPrompt({
          level: ctx.level,
          chunkText: c!.text,
          meaning: c!.meaning,
          sentence,
        }),
        check: checkWriting,
      }),
    ),
  );

  const rows = graded.map((g, i) => {
    const offensive = g.flags.includes("offensive");
    const empty = g.flags.includes("empty_or_nonsense") || g.flags.includes("not_english");
    return {
      sessionId,
      position: i + 1,
      original: offensive ? REMOVED : sentences[i]!,
      corrected: offensive ? REMOVED : g.corrected || sentences[i]!,
      usageGrade: offensive || empty ? 0 : g.usageGrade,
      grammarGrade: offensive || empty ? 0 : g.grammarGrade,
      usesChunk: offensive ? false : g.usesChunk,
      explanation: g.explanation,
    };
  });
  return d.transaction(async (tx) => {
    await tx.delete(writingResult).where(eq(writingResult.sessionId, sessionId));
    return tx.insert(writingResult).values(rows).returning();
  });
}
