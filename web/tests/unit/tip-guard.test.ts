import { describe, expect, it } from "vitest";
import { checkTip } from "@/lib/domain/feedback-guards";

describe("tip post-check (FR-014, Principle II)", () => {
  const input = { allowedNumbers: ["78"] };

  it("accepts warm plain-English tips", () => {
    expect(checkTip("Great clarity! Let your voice fall gently on the last word.", input)).toBeNull();
  });

  it("rejects IPA symbols (hints come only from the curated table)", () => {
    expect(checkTip("Try the /ð/ sound with your tongue out.", input)).toMatch(/ipa/i);
    expect(checkTip("Make the æ wider.", input)).toMatch(/ipa/i);
  });

  it("rejects numbers the app did not supply (scores are never invented)", () => {
    expect(checkTip("You scored 95 today!", input)).toMatch(/number/i);
    expect(checkTip("You scored 78 today!", input)).toBeNull();
  });

  it("rejects non-English text", () => {
    expect(checkTip("¡Muy bien! Sigue practicando cada día.", input)).toMatch(/english/i);
  });
});
