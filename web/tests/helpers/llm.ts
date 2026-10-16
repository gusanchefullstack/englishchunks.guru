import { MockLanguageModelV4 } from "ai/test";
import { setLlmModelFactory } from "@/lib/providers/llm";

/** Mock model that returns the given JSON outputs in order (last one repeats). */
export function mockLlm(outputs: unknown[]) {
  const prompts: string[] = [];
  let i = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (opts) => {
      prompts.push(JSON.stringify(opts.prompt));
      const out = outputs[Math.min(i++, outputs.length - 1)];
      return {
        content: [{ type: "text", text: typeof out === "string" ? out : JSON.stringify(out) }],
        finishReason: { unified: "stop", raw: undefined },
        usage: {
          inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
          outputTokens: { total: 5, text: 5, reasoning: undefined },
        },
        warnings: [],
      };
    },
  });
  setLlmModelFactory(() => model);
  return { prompts, calls: () => i, restore: () => setLlmModelFactory(undefined) };
}
