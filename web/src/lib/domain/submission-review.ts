import "server-only";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import {
  adminAuditLog,
  cefrLevels,
  chunk,
  chunkExample,
  chunkSubmission,
  chunkTypes,
  registers,
  user,
} from "@/db/schema";
import { renderEmail } from "@/emails/render";
import { SubmissionAccepted, SubmissionRejected } from "@/emails/submission-decision";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { emailProvider } from "@/lib/providers/email";
import { scoringClient } from "@/lib/providers/scoring-client";
import { dedupeKey } from "./dedupe";
import { normalizeChunkText } from "./normalize";
import { notifyInApp } from "./notifications";
import { award, SUBMISSION_POINTS } from "./points";

/** Accepting requires a complete chunk record (constitution II: 3 examples, level, type, …). */
export const AcceptedChunk = z.object({
  text: z.string().trim().min(1).max(80),
  type: z.enum(chunkTypes),
  level: z.enum(cefrLevels),
  registers: z.array(z.enum(registers)).min(1),
  meaning: z.string().trim().min(1).max(300),
  usageNote: z.string().trim().min(1).max(400),
  examples: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(200),
        register: z.enum(["casual", "professional"]),
      }),
    )
    .length(3),
});

export const Decision = z.discriminatedUnion("decision", [
  z.object({ submissionId: z.uuid(), decision: z.literal("accept"), chunk: AcceptedChunk }),
  z.object({
    submissionId: z.uuid(),
    decision: z.literal("reject"),
    reason: z.string().trim().max(300).optional(),
  }),
]);

/** FR-044: accept (publish + notify + 20 points) or reject (notify with optional reason). */
export async function decideSubmission(adminId: string, raw: unknown) {
  const d = Decision.parse(raw);
  const appUrl = env().BETTER_AUTH_URL.replace(/\/$/, "");
  const [sub] = await db()
    .select()
    .from(chunkSubmission)
    .where(eq(chunkSubmission.id, d.submissionId));
  if (!sub) throw new AppError("not_found", "Submission not found.");
  if (sub.status !== "pending")
    throw new AppError("conflict", "This submission was already decided.");

  // Deterministic IPA from espeak-ng via the scoring service — never an LLM (Principle II).
  const ipa =
    d.decision === "accept"
      ? await scoringClient.phonemize([d.chunk.text, ...d.chunk.examples.map((e) => e.text)])
      : [];

  const result = await db().transaction(async (tx) => {
    let chunkId: string | null = null;
    if (d.decision === "accept") {
      const [created] = await tx
        .insert(chunk)
        .values({
          text: d.chunk.text,
          normalizedText: normalizeChunkText(d.chunk.text),
          type: d.chunk.type,
          level: d.chunk.level,
          registers: d.chunk.registers,
          meaning: d.chunk.meaning,
          usageNote: d.chunk.usageNote,
          ipa: ipa[0]!,
          source: "submitted",
          submittedBy: sub.submittedBy,
          auditStatus: "admin_approved",
        })
        .returning({ id: chunk.id })
        .catch(() => {
          throw new AppError("conflict", "A chunk with this text already exists.");
        });
      chunkId = created!.id;
      await tx.insert(chunkExample).values(
        d.chunk.examples.map((e, i) => ({
          chunkId: chunkId!,
          position: i + 1,
          text: e.text,
          register: e.register,
          ipa: ipa[i + 1]!,
        })),
      );
    }
    await tx
      .update(chunkSubmission)
      .set({
        status: d.decision === "accept" ? "accepted" : "rejected",
        reviewerId: adminId,
        decisionReason: d.decision === "reject" ? d.reason || null : null,
        decidedAt: new Date(),
        resultingChunkId: chunkId,
        normalizedText: d.decision === "accept" ? dedupeKey(d.chunk.text) : sub.normalizedText,
      })
      .where(eq(chunkSubmission.id, sub.id));
    if (sub.submittedBy) {
      if (d.decision === "accept") {
        await award(tx, sub.submittedBy, "submission_accepted", SUBMISSION_POINTS, sub.id);
        await notifyInApp(
          tx,
          sub.submittedBy,
          "submission_accepted",
          `Your chunk “${d.chunk.text}” was accepted! +${SUBMISSION_POINTS} points.`,
        );
      } else {
        await notifyInApp(
          tx,
          sub.submittedBy,
          "submission_rejected",
          `Your chunk “${sub.text}” wasn't added this time.${d.reason ? ` Note: ${d.reason}` : ""}`,
        );
      }
    }
    await tx.insert(adminAuditLog).values({
      actorId: adminId,
      action: d.decision === "accept" ? "chunk.accept" : "chunk.reject",
      targetId: sub.id,
      details: chunkId ? { chunkId } : {},
    });
    return { chunkId };
  });

  // Email after commit; failures don't undo the decision.
  if (sub.submittedBy) {
    const [u] = await db()
      .select({ name: user.name, email: user.email })
      .from(user)
      .where(eq(user.id, sub.submittedBy));
    if (u) {
      const content =
        d.decision === "accept"
          ? await renderEmail(
              SubmissionAccepted({
                name: u.name,
                chunkText: d.chunk.text,
                points: SUBMISSION_POINTS,
                url: `${appUrl}/library/${result.chunkId}`,
              }),
            )
          : await renderEmail(
              SubmissionRejected({ name: u.name, chunkText: sub.text, reason: d.reason ?? null }),
            );
      await emailProvider()
        .send({
          to: u.email,
          subject:
            d.decision === "accept"
              ? "Your chunk is in the library!"
              : "An update on your chunk suggestion",
          ...content,
        })
        .catch(() => logger.warn({ event: "submission.email_failed" }, "decision email failed"));
    }
  }
  return result;
}
