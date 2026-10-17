import { and, asc, count, desc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cefrLevels, chunk, chunkExample, chunkTypes, registers } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { normalizeChunkText } from "./normalize";

export const PAGE_SIZE = 20;

export const LibraryQuery = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  level: z.enum(cefrLevels).optional().catch(undefined),
  type: z.enum(chunkTypes).optional().catch(undefined),
  register: z.enum(registers).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(500).optional().catch(undefined),
});
export type LibraryQuery = z.infer<typeof LibraryQuery>;

const practicable = and(
  eq(chunk.status, "active"),
  inArray(chunk.auditStatus, ["passed", "admin_approved"]),
);

/** FR-041: text search (full-text + trigram + substring) with level/type/register filters. */
export async function searchChunks(raw: unknown) {
  const query = LibraryQuery.parse(raw ?? {});
  const page = query.page ?? 1;
  const conds: (SQL | undefined)[] = [practicable];
  if (query.level) conds.push(eq(chunk.level, query.level));
  if (query.type) conds.push(eq(chunk.type, query.type));
  if (query.register) conds.push(sql`${query.register} = any(${chunk.registers})`);

  let relevance: SQL | null = null;
  if (query.q) {
    const norm = normalizeChunkText(query.q);
    const doc = sql`to_tsvector('english', ${chunk.text} || ' ' || ${chunk.meaning})`;
    const tsq = sql`websearch_to_tsquery('english', ${query.q})`;
    conds.push(
      or(
        sql`${doc} @@ ${tsq}`,
        sql`similarity(${chunk.normalizedText}, ${norm}) > 0.3`,
        sql`${chunk.normalizedText} ilike ${`%${norm}%`}`,
        sql`${chunk.meaning} ilike ${`%${query.q}%`}`,
      ),
    );
    relevance = sql`(similarity(${chunk.normalizedText}, ${norm}) * 2 + ts_rank(${doc}, ${tsq}))`;
  }
  const where = and(...conds);
  const d = db();
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    d
      .select({
        id: chunk.id,
        text: chunk.text,
        meaning: chunk.meaning,
        level: chunk.level,
        type: chunk.type,
        registers: chunk.registers,
      })
      .from(chunk)
      .where(where)
      .orderBy(...(relevance ? [desc(relevance)] : []), asc(chunk.level), asc(chunk.text))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    d.select({ total: count() }).from(chunk).where(where),
  ]);
  return { query, items: rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getLibraryChunk(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError("not_found", "Chunk not found.");
  const d = db();
  const [c] = await d
    .select()
    .from(chunk)
    .where(and(eq(chunk.id, id), practicable));
  if (!c) throw new AppError("not_found", "Chunk not found.");
  const examples = await d
    .select()
    .from(chunkExample)
    .where(eq(chunkExample.chunkId, id))
    .orderBy(asc(chunkExample.position));
  return { chunk: c, examples };
}

export async function libraryTotal() {
  const [r] = await db().select({ n: count() }).from(chunk).where(practicable);
  return r?.n ?? 0;
}
