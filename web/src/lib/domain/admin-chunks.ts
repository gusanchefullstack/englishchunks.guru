import "server-only";
import { and, asc, count, desc, eq, gte, ilike, inArray, ne, or, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import type { chunkStatus } from "@/db/schema";
import { adminAuditLog, chunk, chunkExample } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { scoringClient } from "@/lib/providers/scoring-client";
import { logAdmin } from "./audit";
import { dedupeKey } from "./dedupe";
import { normalizeChunkText } from "./normalize";
import { AcceptedChunk } from "./submission-review";

/** True when an example contains the chunk's words in order (slots and inflections allowed). */
export function exampleContainsChunk(chunkText: string, example: string) {
  const want = dedupeKey(chunkText)
    .split(" ")
    .filter((w) => w !== "_slot_" && w.length > 0);
  const have = dedupeKey(example).split(" ");
  let i = 0;
  // `${w}e`: e-dropping forms ("making" → "mak", "used" → "us") still match "make"/"use".
  for (const w of have) if (w === want[i] || `${w}e` === want[i]) i++;
  return i === want.length;
}

export const ChunkFilter = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  view: z.enum(["active", "retired", "audit_failed"]).optional().catch(undefined),
});

export async function listAdminChunks(raw: unknown) {
  const f = ChunkFilter.parse(raw ?? {});
  const conds: (SQL | undefined)[] = [];
  if (f.view === "audit_failed") conds.push(eq(chunk.auditStatus, "failed"));
  else conds.push(eq(chunk.status, f.view === "retired" ? "retired" : "active"));
  if (f.q) conds.push(or(ilike(chunk.text, `%${f.q}%`), ilike(chunk.meaning, `%${f.q}%`)));
  const rows = await db()
    .select()
    .from(chunk)
    .where(and(...conds))
    .orderBy(desc(chunk.updatedAt))
    .limit(100);
  return { filter: f, rows };
}

export const ModerationFilter = z.object({
  tab: z.enum(["pending", "accepted", "rejected"]).catch("pending").default("pending"),
  q: z.string().trim().max(80).optional().catch(undefined),
});
export type ModerationTab = z.infer<typeof ModerationFilter>["tab"];

const TAB_WHERE: Record<ModerationTab, SQL | undefined> = {
  // The auditor flagged it and nobody has decided yet.
  pending: and(eq(chunk.auditStatus, "failed"), eq(chunk.status, "active")),
  accepted: eq(chunk.auditStatus, "admin_approved"),
  rejected: and(eq(chunk.auditStatus, "failed"), eq(chunk.status, "retired")),
};

/** Chunk moderation queue: flagged chunks with their examples and the auditor's notes. */
export async function listModeration(raw: unknown) {
  const f = ModerationFilter.parse(raw ?? {});
  const where = and(
    TAB_WHERE[f.tab],
    f.q ? or(ilike(chunk.text, `%${f.q}%`), ilike(chunk.meaning, `%${f.q}%`)) : undefined,
  );
  const rows = await db()
    .select()
    .from(chunk)
    .where(where)
    .orderBy(
      ...(f.tab === "pending" ? [asc(chunk.level), asc(chunk.createdAt)] : [desc(chunk.updatedAt)]),
    )
    .limit(50);
  const examples = rows.length
    ? await db()
        .select()
        .from(chunkExample)
        .where(
          inArray(
            chunkExample.chunkId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(asc(chunkExample.position))
    : [];
  return {
    tab: f.tab,
    q: f.q,
    rows: rows.map((r) => ({ ...r, examples: examples.filter((e) => e.chunkId === r.id) })),
  };
}

export async function pendingModerationCount() {
  const [r] = await db().select({ n: count() }).from(chunk).where(TAB_WHERE.pending);
  return r?.n ?? 0;
}

/** Accept a flagged chunk as it is (the curated record and the auditor's notes are kept). */
export async function approveChunk(adminId: string, id: string) {
  const [row] = await db()
    .update(chunk)
    .set({ auditStatus: "admin_approved" })
    .where(and(eq(chunk.id, id), TAB_WHERE.pending))
    .returning({ id: chunk.id });
  if (!row) throw new AppError("conflict", "This chunk isn't waiting for review anymore.");
  await logAdmin(adminId, "chunk.approve", id);
}

const DECISIONS = ["chunk.approve", "chunk.deny"];

export async function moderationStats(now = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const d = db();
  const [library] = await d
    .select({ n: count() })
    .from(chunk)
    .where(
      and(
        eq(chunk.status, "active"),
        ne(chunk.auditStatus, "failed"),
        ne(chunk.auditStatus, "pending"),
      ),
    );
  const decisions = await d
    .select({ action: adminAuditLog.action, n: count() })
    .from(adminAuditLog)
    .where(inArray(adminAuditLog.action, DECISIONS))
    .groupBy(adminAuditLog.action);
  const [week] = await d
    .select({ n: count() })
    .from(adminAuditLog)
    .where(and(inArray(adminAuditLog.action, DECISIONS), gte(adminAuditLog.createdAt, weekAgo)));
  const approved = decisions.find((x) => x.action === "chunk.approve")?.n ?? 0;
  const denied = decisions.find((x) => x.action === "chunk.deny")?.n ?? 0;
  return {
    librarySize: library?.n ?? 0,
    reviewedThisWeek: week?.n ?? 0,
    acceptanceRate: approved + denied ? Math.round((approved / (approved + denied)) * 100) : null,
  };
}

export async function getAdminChunk(id: string) {
  const [c] = await db().select().from(chunk).where(eq(chunk.id, id));
  if (!c) throw new AppError("not_found", "Chunk not found.");
  const examples = await db()
    .select()
    .from(chunkExample)
    .where(eq(chunkExample.chunkId, id))
    .orderBy(asc(chunkExample.position));
  return { chunk: c, examples };
}

/** T123: create or edit a chunk; IPA recomputed by espeak-ng; exactly 3 examples containing the chunk. */
export async function upsertChunk(adminId: string, id: string | null, raw: unknown) {
  const input = AcceptedChunk.parse(raw);
  const bad = input.examples.findIndex((e) => !exampleContainsChunk(input.text, e.text));
  if (bad >= 0)
    throw new AppError("validation", `Example ${bad + 1} doesn't contain “${input.text}”.`);
  const ipa = await scoringClient.phonemize([input.text, ...input.examples.map((e) => e.text)]);
  const values = {
    text: input.text,
    normalizedText: normalizeChunkText(input.text),
    type: input.type,
    level: input.level,
    registers: input.registers,
    meaning: input.meaning,
    usageNote: input.usageNote,
    ipa: ipa[0]!,
    auditStatus: "admin_approved" as const,
  };
  const chunkId = await db().transaction(async (tx) => {
    let cid = id;
    if (cid) {
      const [u] = await tx
        .update(chunk)
        .set(values)
        .where(eq(chunk.id, cid))
        .returning({ id: chunk.id });
      if (!u) throw new AppError("not_found", "Chunk not found.");
      await tx.delete(chunkExample).where(eq(chunkExample.chunkId, cid));
    } else {
      const [c] = await tx
        .insert(chunk)
        .values({ ...values, source: "curated" })
        .returning({ id: chunk.id })
        .catch(() => {
          throw new AppError("conflict", "A chunk with this text already exists.");
        });
      cid = c!.id;
    }
    await tx.insert(chunkExample).values(
      input.examples.map((e, i) => ({
        chunkId: cid!,
        position: i + 1,
        text: e.text,
        register: e.register,
        ipa: ipa[i + 1]!,
      })),
    );
    await logAdmin(adminId, id ? "chunk.update" : "chunk.create", cid, {}, tx);
    return cid!;
  });
  return { id: chunkId };
}

export async function setChunkStatus(
  adminId: string,
  id: string,
  status: (typeof chunkStatus.enumValues)[number],
) {
  const [row] = await db()
    .update(chunk)
    .set({ status })
    .where(eq(chunk.id, id))
    .returning({ id: chunk.id, auditStatus: chunk.auditStatus });
  if (!row) throw new AppError("not_found", "Chunk not found.");
  // Retiring a flagged chunk is a moderation decision ("deny"); it feeds the acceptance rate.
  const action =
    status === "retired"
      ? row.auditStatus === "failed"
        ? "chunk.deny"
        : "chunk.retire"
      : "chunk.restore";
  await logAdmin(adminId, action, id);
}
