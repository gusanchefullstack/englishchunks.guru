import { z } from "zod";
import { cefrLevels, chunkTypes, registers } from "@/db/schema/enums";

/** Structured LLM outputs — contracts/llm-outputs.md. Over-limit output fails validation → retry. */

export const wordCount = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const maxWords = (n: number) => (s: string) => wordCount(s) <= n;

export const PronunciationTip = z.object({
  message: z
    .string()
    .min(1)
    .refine(maxWords(45), "message must be at most 45 words")
    .describe("1–3 warm, specific sentences in simple English (≤ 45 words)."),
});
export type PronunciationTip = z.infer<typeof PronunciationTip>;

export const WritingFeedback = z.object({
  usesChunk: z.boolean(),
  usageGrade: z.int().min(0).max(100),
  grammarGrade: z.int().min(0).max(100),
  corrected: z.string().max(300),
  explanation: z
    .string()
    .refine(maxWords(25), "explanation must be at most 25 words")
    .describe("At most one sentence, ≤ 25 words, English at the learner's level."),
  flags: z.array(z.enum(["offensive", "not_english", "empty_or_nonsense"])),
});
export type WritingFeedback = z.infer<typeof WritingFeedback>;

export const ChunkDraft = z.object({
  text: z.string().min(1).max(80),
  type: z.enum(chunkTypes),
  level: z.enum(cefrLevels),
  registers: z.array(z.enum(registers)).min(1),
  meaning: z.string().min(1).max(300),
  usageNote: z.string().min(1).max(400),
  examples: z
    .array(
      z.object({
        text: z.string().min(1).max(200),
        // FR-011: examples are casual or professional. Models sometimes label a formal example
        // "academic"; that is the professional side of the app's two labels.
        register: z.preprocess(
          (v) => (typeof v === "string" && /^(academic|formal)$/i.test(v) ? "professional" : v),
          z.enum(["casual", "professional"]),
        ),
      }),
    )
    .length(3),
});
export type ChunkDraft = z.infer<typeof ChunkDraft>;

export const ChunkAudit = z.object({
  verdict: z.enum(["pass", "fail"]),
  levelOk: z.boolean(),
  suggestedLevel: z.enum(cefrLevels).optional(),
  meaningAccurate: z.boolean(),
  examplesNatural: z.boolean(),
  examplesContainChunk: z.boolean(),
  issues: z.array(z.string()),
});
export type ChunkAudit = z.infer<typeof ChunkAudit>;
