import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { chunk, chunkExample, type CefrLevel, type ChunkType, type Register } from "@/db/schema";
import { ChunkAudit, ChunkDraft } from "@/lib/contracts/llm";
import { llm } from "@/lib/providers/llm";
import { scoringClient } from "@/lib/providers/scoring-client";
import { exampleContainsChunk } from "./admin-chunks";
import { dedupeKey } from "./dedupe";
import { normalizeChunkText } from "./normalize";

export type Seed = { text: string; level?: CefrLevel; type?: ChunkType; register?: Register };
export type SeedOutcome = { text: string; result: "imported" | "needs_review" | "skipped_duplicate" | "error"; issues?: string[] };

/** Parses `text,level,type,register` lines (header + # comments ignored; quotes for commas). */
export function parseSeedCsv(csv: string): Seed[] {
  const out: Seed[] = [];
  for (const raw of csv.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#") || /^text,/.test(line)) continue;
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
    const [text, level, type, register] = cells;
    if (text) out.push({ text, level: (level || undefined) as CefrLevel, type: (type || undefined) as ChunkType, register: (register || undefined) as Register });
  }
  return out;
}

const DRAFT_SYSTEM = [
  "You write entries for an English-learning chunk library for ESOL learners (CEFR A1–C2).",
  "Return a complete, accurate record: the chunk's type, CEFR level, registers, a plain meaning (≤ 300 chars),",
  "guidance on when to use it (≤ 400 chars), and exactly three natural American-English examples that each",
  "contain the chunk (inflections allowed): two casual and one professional where possible; label each example",
  "'casual' or 'professional' only (formal or academic examples are 'professional'). Use simple language",
  "that a learner at the chunk's level can understand. Do not include IPA.",
].join(" ");

const AUDIT_SYSTEM = [
  "You are an independent reviewer of an English-learning chunk library (constitution: facts must be correct).",
  "Check the record: is the meaning accurate, is the CEFR level appropriate, are the examples natural",
  "American English, and does every example contain the chunk? Be strict; fail anything doubtful and list issues.",
].join(" ");

/** One seed → draft (Gemma) → independent audit (gpt-oss) → espeak IPA → import (research R2). */
export async function seedOne(seed: Seed, existingKeys: Set<string>): Promise<SeedOutcome> {
  const key = dedupeKey(seed.text);
  if (existingKeys.has(key)) return { text: seed.text, result: "skipped_duplicate" };
  try {
    const hint = [seed.level && `level ${seed.level}`, seed.type && `type ${seed.type}`, seed.register && `register ${seed.register}`].filter(Boolean).join(", ");
    const draft = await llm.generate({
      role: "feedback",
      schema: ChunkDraft,
      system: DRAFT_SYSTEM,
      // Batch work: wait for the drafting model; never redraft with the auditor's model.
      noFallback: true,
      timeoutMs: 45_000,
      prompt: `Chunk: "${seed.text}"${hint ? `\nSuggested: ${hint}` : ""}`,
    });
    const audit = await llm.generate({
      role: "audit",
      schema: ChunkAudit,
      system: AUDIT_SYSTEM,
      prompt: JSON.stringify(draft),
    });
    // Deterministic check in addition to the model's opinion.
    const missing = draft.examples.filter((e) => !exampleContainsChunk(draft.text, e.text));
    const issues = [...audit.issues, ...missing.map((e) => `Example doesn't contain the chunk: "${e.text}"`)];
    const passed = audit.verdict === "pass" && audit.levelOk && audit.meaningAccurate && audit.examplesNatural && missing.length === 0;
    const ipa = await scoringClient.phonemize([draft.text, ...draft.examples.map((e) => e.text)]);
    await db().transaction(async (tx) => {
      const [c] = await tx
        .insert(chunk)
        .values({
          text: draft.text,
          normalizedText: normalizeChunkText(draft.text),
          type: draft.type,
          // A curated level wins; a model's disagreement still sends the chunk to admin review.
          level: seed.level ?? (audit.suggestedLevel && !audit.levelOk ? audit.suggestedLevel : draft.level),
          registers: draft.registers,
          meaning: draft.meaning,
          usageNote: draft.usageNote,
          ipa: ipa[0]!,
          source: "curated",
          auditStatus: passed ? "passed" : "failed", // failed → admin "audit failed" queue, not practicable
          auditNotes: {
            verdict: audit.verdict,
            issues,
            ...(audit.levelOk ? {} : { suggestedLevel: audit.suggestedLevel ?? draft.level }),
            auditor: process.env.AI_AUDIT_MODEL ?? "openai/gpt-oss-20b",
          },
        })
        .returning({ id: chunk.id });
      await tx.insert(chunkExample).values(draft.examples.map((e, i) => ({ chunkId: c!.id, position: i + 1, text: e.text, register: e.register, ipa: ipa[i + 1]! })));
    });
    existingKeys.add(key);
    return { text: seed.text, result: passed ? "imported" : "needs_review", issues: passed ? undefined : issues };
  } catch (err) {
    return { text: seed.text, result: "error", issues: [(err as Error).message] };
  }
}

/** Runs the pipeline with bounded concurrency; resumable (existing chunks are skipped). */
export async function seedLibrary(seeds: Seed[], opts: { concurrency?: number; onProgress?: (o: SeedOutcome, done: number) => void } = {}) {
  const rows = await db().select({ text: chunk.text }).from(chunk);
  const existing = new Set(rows.map((r) => dedupeKey(r.text)));
  const queue = [...seeds];
  const results: SeedOutcome[] = [];
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const o = await seedOne(s, existing);
      results.push(o);
      opts.onProgress?.(o, results.length);
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  const count = (r: SeedOutcome["result"]) => results.filter((x) => x.result === r).length;
  return { results, imported: count("imported"), needsReview: count("needs_review"), skipped: count("skipped_duplicate"), errors: count("error") };
}

export async function countByLevel() {
  const rows = await db().select({ level: chunk.level }).from(chunk).where(eq(chunk.status, "active"));
  return rows.reduce<Record<string, number>>((acc, r) => ((acc[r.level] = (acc[r.level] ?? 0) + 1), acc), {});
}
