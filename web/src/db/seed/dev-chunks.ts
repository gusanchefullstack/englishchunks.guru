import { normalizeChunkText } from "@/lib/domain/normalize";
import type { Db } from "../client";
import { chunk, chunkExample, type ChunkType, type CefrLevel, type Register } from "../schema";
import data from "./dev-chunks.json";

type DevChunk = {
  text: string;
  type: ChunkType;
  level: CefrLevel;
  registers: Register[];
  meaning: string;
  usageNote: string;
  ipa: string;
  examples: { position: number; text: string; register: "casual" | "professional"; ipa: string }[];
};

export const devChunks = data as DevChunk[];

/** 30 hand-checked chunks (5 per CEFR level) with espeak-ng IPA, for development and tests. */
export async function seedDevChunks(db: Db) {
  for (const c of devChunks) {
    const [row] = await db
      .insert(chunk)
      .values({
        text: c.text,
        normalizedText: normalizeChunkText(c.text),
        type: c.type,
        level: c.level,
        registers: c.registers,
        meaning: c.meaning,
        usageNote: c.usageNote,
        ipa: c.ipa,
        source: "curated",
        auditStatus: "admin_approved",
      })
      .onConflictDoNothing()
      .returning({ id: chunk.id });
    if (!row) continue;
    await db.insert(chunkExample).values(c.examples.map((e) => ({ ...e, chunkId: row.id })));
  }
  return devChunks.length;
}
