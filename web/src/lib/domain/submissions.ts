import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { chunk, chunkSubmission } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { consume } from "./caps";
import { dedupeKey, findDuplicates } from "./dedupe";
import { practiceDateFor } from "./time";

export const SubmitInput = z.object({
  text: z.string().trim().min(2).max(80),
  meaning: z.string().trim().max(300).optional().or(z.literal("")),
  example: z.string().trim().max(200).optional().or(z.literal("")),
  acknowledgeSimilar: z.boolean().default(false),
});

const SUBMISSIONS_PER_DAY = 5;

async function activeChunks() {
  return db()
    .select({ id: chunk.id, text: chunk.text, level: chunk.level, meaning: chunk.meaning })
    .from(chunk)
    .where(eq(chunk.status, "active"));
}

/** FR-043: live check before submitting. */
export async function checkDuplicate(text: string) {
  const t = text.trim();
  if (t.length < 2) return { exact: null, similar: [] };
  return findDuplicates(t, await activeChunks());
}

/**
 * FR-043/FR-044: exact matches can't be submitted; close matches need acknowledgement;
 * a repeat of another pending suggestion is merged into it (first submitter keeps credit).
 */
export async function submitChunk(user: { id: string; timeZone: string }, raw: unknown) {
  const input = SubmitInput.parse(raw);
  const dup = findDuplicates(input.text, await activeChunks());
  if (dup.exact) {
    throw new AppError("conflict", `“${dup.exact.text}” is already in the library.`, {
      chunkId: dup.exact.id,
    });
  }
  if (dup.similar.length && !input.acknowledgeSimilar) {
    throw new AppError("validation", "Please check the similar chunks first.", {
      similar: dup.similar.map((s) => s.id),
    });
  }
  await consume(
    `submit:${user.id}:${practiceDateFor(user.timeZone)}`,
    SUBMISSIONS_PER_DAY,
    "You've suggested 5 chunks today. Thank you! Try again tomorrow.",
  );
  const key = dedupeKey(input.text);
  const [firstPending] = await db()
    .select({ id: chunkSubmission.id })
    .from(chunkSubmission)
    .where(and(eq(chunkSubmission.normalizedText, key), eq(chunkSubmission.status, "pending")))
    .orderBy(chunkSubmission.createdAt)
    .limit(1);
  const [row] = await db()
    .insert(chunkSubmission)
    .values({
      submittedBy: user.id,
      text: input.text,
      normalizedText: key,
      proposedMeaning: input.meaning || null,
      proposedExample: input.example || null,
      matchedChunkIds: dup.similar.map((s) => s.id),
      status: firstPending ? "merged" : "pending",
      mergedInto: firstPending?.id ?? null,
    })
    .returning();
  return row!;
}

export async function mySubmissions(userId: string) {
  return db()
    .select()
    .from(chunkSubmission)
    .where(eq(chunkSubmission.submittedBy, userId))
    .orderBy(desc(chunkSubmission.createdAt));
}

export async function pendingSubmissions() {
  const rows = await db()
    .select()
    .from(chunkSubmission)
    .where(eq(chunkSubmission.status, "pending"))
    .orderBy(chunkSubmission.createdAt);
  const matchIds = [...new Set(rows.flatMap((r) => r.matchedChunkIds))];
  const matches = matchIds.length
    ? await db()
        .select({ id: chunk.id, text: chunk.text })
        .from(chunk)
        .where(inArray(chunk.id, matchIds))
    : [];
  return rows.map((r) => ({
    ...r,
    matches: matches.filter((m) => r.matchedChunkIds.includes(m.id)),
  }));
}
