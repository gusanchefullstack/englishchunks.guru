# LLM Structured-Output Contracts

**Spec**: [../spec.md](../spec.md) | **Research**: R1, R2

All LLM calls use structured output validated against these schemas (Zod in
`web/src/lib/contracts/llm.ts`). Invalid output → one retry → user-friendly `unavailable` error.
Model ids come from config (`AI_FEEDBACK_MODEL`, `AI_AUDIT_MODEL`).

Hard rules (constitution Principle II, spec FR-014, FR-016a):
- LLMs never produce or alter numeric pronunciation scores, IPA, or sound hints. Scores and
  hints are inputs to the prompt and are rendered by the app, not copied from model output.
- All output text is English, using vocabulary/sentence length suitable for the learner's CEFR
  level; prompts include the level and a max-words budget.
- Learner text is passed as clearly delimited data, never as instructions.

## 1. Pronunciation tip — `PronunciationTip`

Input to model: level, item text, overall score, weakest sounds with their fixed hints from
`sound_hint`, (try 2 only) previous score.

```ts
{
  message: string // 1–3 sentences, ≤ 45 words, warm and specific;
                  // must not contain digits other than those the app supplies
}
```

The app renders: score (from scoring service) + each weakest sound's fixed hint + `message`.
A post-check rejects messages that include IPA symbols or numbers not present in the input.

## 2. Writing feedback — `WritingFeedback` (×3 per session)

Input: level, chunk text/meaning, learner sentence (delimited).

```ts
{
  usesChunk: boolean,           // chunk (or valid inflection/slot filling) is present
  usageGrade: number,           // 0–100 integer, correct and natural use of the chunk
  grammarGrade: number,         // 0–100 integer
  corrected: string,            // ≤ 300 chars; identical to input if already correct
  explanation: string,          // ≤ 1 sentence, ≤ 25 words, level-appropriate English
  flags: ("offensive" | "not_english" | "empty_or_nonsense")[]
}
```

Writing grades are the only grades an LLM produces; they are text grades, not pronunciation
scores. `flags.offensive` → original text stored as `[removed]`.

## 3. Daily chunk record (library seeding) — `ChunkDraft`

```ts
{
  text: string, type: ChunkType, level: Cefr, registers: Register[],
  meaning: string,   // ≤ 300 chars
  usageNote: string, // ≤ 400 chars
  examples: [{ text: string, register: "casual" | "professional" }] // exactly 3
}
```

IPA is added afterwards via the scoring service `/v1/phonemize`.

## 4. Chunk audit — `ChunkAudit` (independent model)

```ts
{
  verdict: "pass" | "fail",
  levelOk: boolean, suggestedLevel?: Cefr,
  meaningAccurate: boolean, examplesNatural: boolean, examplesContainChunk: boolean,
  issues: string[]   // short reasons, empty when pass
}
```

`fail` or any `false` → chunk imported with `audit_status = failed` into the admin review queue,
not the live library.
