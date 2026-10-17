import "server-only";
import {
  createGateway,
  generateText,
  NoObjectGeneratedError,
  Output,
  type LanguageModel,
} from "ai";
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { recordUsage } from "@/lib/domain/usage";
import { e2eMode } from "@/lib/e2e";

export type LlmRole = "feedback" | "audit";

export type LlmRequest<S extends z.ZodType> = {
  role: LlmRole;
  schema: S;
  system: string;
  prompt: string;
  /** Optional semantic check after schema validation; return a reason to reject and retry. */
  check?: (value: z.infer<S>) => string | null;
  /** Per-attempt time limit (defaults per role). */
  timeoutMs?: number;
  /** Retry on the same model (e.g. library drafts must never be written by the auditor model). */
  noFallback?: boolean;
};

/** Open-weight LLM access (constitution I). Swappable: model ids come from config. */
export interface LlmProvider {
  generate<S extends z.ZodType>(req: LlmRequest<S>): Promise<z.infer<S>>;
}

type ModelFactory = (role: LlmRole, attempt: number) => LanguageModel;

/**
 * Feedback retries on the other open-weight model: Gemma's gateway providers sometimes take
 * 30+ s. The auditor never falls back to the drafting model (it must stay independent).
 */
const gatewayModels: ModelFactory = (role, attempt) => {
  const e = env();
  const gateway = createGateway({ apiKey: e.AI_GATEWAY_API_KEY });
  if (role === "audit") return gateway(e.AI_AUDIT_MODEL);
  return gateway(attempt === 1 ? e.AI_FEEDBACK_MODEL : e.AI_AUDIT_MODEL);
};

/**
 * Per-attempt limits. Learners wait on feedback: Gemma usually answers in 2–5 s but its gateway
 * providers have a 30+ s tail, so after 5 s we switch to the fallback model, which then gets a
 * roomier limit (writing grades take it 2.5–5 s). Seeding audits are batch work.
 */
const TIMEOUT_MS: Record<LlmRole, [first: number, retry: number]> = {
  feedback: [5_000, 12_000],
  audit: [45_000, 45_000],
};

async function e2eModels(): Promise<ModelFactory> {
  const { MockLanguageModelV4 } = await import("ai/test");
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      const isWriting = JSON.stringify(opts.prompt).includes("learner_sentence");
      const out = isWriting
        ? {
            usesChunk: true,
            usageGrade: 92,
            grammarGrade: 88,
            corrected: "",
            explanation: "Clear and natural.",
            flags: [],
          }
        : { message: "Lovely! Keep the rhythm smooth and relaxed." };
      if (isWriting) {
        const m = JSON.stringify(opts.prompt).match(
          /<learner_sentence>\\n(.*?)\\n<\/learner_sentence>/,
        );
        (out as { corrected: string }).corrected = m?.[1] ?? "That makes sense.";
      }
      return {
        content: [{ type: "text", text: JSON.stringify(out) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 1, noCache: 1, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 1, text: 1, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  return () => model;
}

let modelFactory: ModelFactory = gatewayModels;
let e2eReady: Promise<void> | undefined;

/** Test-only: inject mock models (e.g. MockLanguageModelV4). */
export function setLlmModelFactory(next: ModelFactory | undefined) {
  modelFactory = next ?? gatewayModels;
}

const MAX_ATTEMPTS = 2; // one retry on invalid output (contracts/llm-outputs.md)

/**
 * Some gateway providers (e.g. Gemma's) don't support JSON-schema response formats and drop the
 * schema silently, so the model invents its own keys. Stating the schema in the system prompt
 * works for every model; Output.object still parses and validates the reply.
 */
function withSchema(system: string, schema: z.ZodType) {
  return `${system}\n\nRespond with only a JSON object (no code fences, no other text) matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(schema))}`;
}

export const llm: LlmProvider = {
  async generate({ role, schema, system, prompt, check, timeoutMs, noFallback }) {
    if (e2eMode() && modelFactory === gatewayModels) {
      e2eReady ??= e2eModels().then((f) => void (modelFactory = f));
      await e2eReady;
    }
    let lastReason = "";
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await generateText({
          model: modelFactory(role, noFallback ? 1 : attempt),
          system: withSchema(system, schema),
          prompt:
            attempt === 1
              ? prompt
              : `${prompt}\n\nYour previous answer was invalid (${lastReason}). Follow every limit exactly.`,
          output: Output.object({ schema }),
          temperature: 0.3,
          maxRetries: 0, // we retry ourselves (once, on the fallback model for feedback)
          abortSignal: AbortSignal.timeout(timeoutMs ?? TIMEOUT_MS[role][attempt - 1]!),
        });
        await Promise.all([
          recordUsage("llm_tokens_in", result.usage.inputTokens ?? 0),
          recordUsage("llm_tokens_out", result.usage.outputTokens ?? 0),
        ]).catch(() => undefined);
        const value = result.output as z.infer<typeof schema>;
        const reason = check?.(value) ?? null;
        if (!reason) return value;
        lastReason = reason;
      } catch (err) {
        if (NoObjectGeneratedError.isInstance(err)) {
          lastReason = "output did not match the required format";
        } else {
          // Timeouts and provider errors: log and move on to the next attempt.
          logger.warn({ role, attempt, err: (err as Error).name }, "llm call failed");
          lastReason = "no answer in time";
        }
      }
    }
    logger.warn({ role }, "llm output invalid after retry");
    throw new AppError("unavailable", "Feedback is taking a break. Please try again.");
  },
};
