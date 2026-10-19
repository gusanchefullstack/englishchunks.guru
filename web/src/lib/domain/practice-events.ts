import "server-only";
import { and, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { practiceEvent, practiceSession, sessionSteps, type PracticeEventKind } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { consume } from "./caps";

/** FR-074: events older than this are deleted (the privacy page states the same number). */
export const PRACTICE_EVENT_RETENTION_DAYS = 30;
/** Constitution V: a page can't flood the table; past this the browser's reports are dropped. */
export const CLIENT_EVENTS_PER_DAY = 30;

const MIC_ERRORS = [
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "SecurityError",
  "AbortError",
  "OverconstrainedError",
  "unknown",
] as const;

/**
 * What the browser may report. Every reason is an allow-listed code (a DOMException name, an
 * HTTP status, a Next.js error digest) so no free text, tokens or personal data get stored.
 */
export const ClientEventInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("mic_denied"),
    sessionId: z.uuid(),
    step: z.enum(sessionSteps).optional(),
    reason: z.enum(MIC_ERRORS),
  }),
  z.object({
    kind: z.literal("mic_unsupported"),
    sessionId: z.uuid(),
    step: z.enum(sessionSteps).optional(),
  }),
  z.object({
    kind: z.literal("upload_failed"),
    sessionId: z.uuid(),
    step: z.enum(sessionSteps).optional(),
    reason: z.string().regex(/^(offline|http_[45]\d\d)$/),
  }),
  z.object({
    kind: z.literal("page_error"),
    sessionId: z.uuid().optional(),
    reason: z.string().regex(/^[A-Za-z0-9_-]{1,40}$/),
  }),
]);
export type ClientEventInput = z.infer<typeof ClientEventInput>;

type ServerEvent = {
  userId: string;
  sessionId?: string;
  kind: PracticeEventKind;
  step?: (typeof sessionSteps)[number];
  reason?: string;
};

/** Best effort: a diagnostics write must never break the practice it describes. */
export async function logPracticeEvent(e: ServerEvent) {
  try {
    await db()
      .insert(practiceEvent)
      .values({ ...e, reason: e.reason?.slice(0, 40) });
  } catch (err) {
    logger.warn({ err, kind: e.kind }, "practice_event.write_failed");
  }
}

/** Stores one browser report for the signed-in learner (POST /api/events). */
export async function recordClientEvent(userId: string, input: ClientEventInput, now = new Date()) {
  if (input.sessionId) {
    const [s] = await db()
      .select({ id: practiceSession.id })
      .from(practiceSession)
      .where(and(eq(practiceSession.id, input.sessionId), eq(practiceSession.userId, userId)));
    if (!s) throw new AppError("not_found", "Session not found.");
  }
  await consume(
    `events:${userId}:${now.toISOString().slice(0, 10)}`,
    CLIENT_EVENTS_PER_DAY,
    "Too many reports today.",
  );
  await db()
    .insert(practiceEvent)
    .values({
      userId,
      sessionId: input.sessionId,
      kind: input.kind,
      step: "step" in input ? input.step : undefined,
      reason: "reason" in input ? input.reason : undefined,
    });
}

/** Hourly cron: drop diagnostics past the retention window. Returns the number deleted. */
export async function prunePracticeEvents(now = new Date()) {
  const cutoff = new Date(now.getTime() - PRACTICE_EVENT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const gone = await db()
    .delete(practiceEvent)
    .where(lt(practiceEvent.createdAt, cutoff))
    .returning({ id: practiceEvent.id });
  return gone.length;
}
