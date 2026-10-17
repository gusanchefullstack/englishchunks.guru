import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { usageCounter } from "@/db/schema";
import { PronunciationTip } from "@/lib/contracts/llm";
import { AppError } from "@/lib/errors";
import { llm } from "@/lib/providers/llm";
import { createTestDb } from "../helpers/db";
import { mockLlm } from "../helpers/llm";

let db: Db;
let close: () => Promise<void>;
let restore: (() => void) | undefined;
beforeAll(async () => ({ db, close } = await createTestDb()));
afterAll(() => close());
afterEach(() => restore?.());

const req = { role: "feedback" as const, schema: PronunciationTip, system: "s", prompt: "p" };

describe("LlmProvider", () => {
  it("returns schema-valid output and records token usage", async () => {
    ({ restore } = mockLlm([{ message: "Lovely! Let your voice fall on sense." }]));
    await expect(llm.generate(req)).resolves.toEqual({
      message: "Lovely! Let your voice fall on sense.",
    });
    const rows = await db.select().from(usageCounter);
    expect(rows.map((r) => r.metric).sort()).toEqual(["llm_tokens_in", "llm_tokens_out"]);
  });

  it("retries once when the output breaks a limit, then succeeds", async () => {
    const tooLong = { message: Array(60).fill("word").join(" ") };
    const m = mockLlm([tooLong, { message: "Short and kind." }]);
    restore = m.restore;
    await expect(llm.generate(req)).resolves.toEqual({ message: "Short and kind." });
    expect(m.calls()).toBe(2);
  });

  it("fails with a friendly `unavailable` error after the retry", async () => {
    ({ restore } = mockLlm(["not json at all"]));
    const err = await llm.generate(req).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe("unavailable");
  });

  it("states the JSON schema in the prompt (gateway providers without structured outputs drop it)", async () => {
    const m = mockLlm([{ message: "Nice." }]);
    restore = m.restore;
    await llm.generate(req);
    // Gemma via the AI Gateway ignored responseFormat and invented its own keys ("tip").
    expect(m.prompts[0]).toContain("JSON Schema");
    expect(m.prompts[0]).toContain('\\"message\\"');
  });

  it("applies the semantic check and retries", async () => {
    const m = mockLlm([{ message: "Score 55 is fine" }, { message: "Nice work!" }]);
    restore = m.restore;
    const out = await llm.generate({
      ...req,
      check: (v) => (/\d/.test(v.message) ? "no numbers" : null),
    });
    expect(out.message).toBe("Nice work!");
  });
});
