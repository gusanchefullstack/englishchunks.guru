import { createHmac } from "node:crypto";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { AppError } from "@/lib/errors";
import { setTestEnv } from "@/lib/env";
import { scoringClient } from "@/lib/providers/scoring-client";
import { scoringMock } from "../mocks/handlers";

beforeAll(() => setTestEnv());
afterEach(() => scoringMock.reset());

const input = {
  audio: new Blob([new Uint8Array(2048)], { type: "audio/webm" }),
  mimeType: "audio/webm" as const,
  expectedText: "That makes sense.",
  level: "B1" as const,
};

describe("scoringClient", () => {
  it("signs requests with HMAC over timestamp.requestId", async () => {
    await scoringClient.score({ ...input, requestId: "req-1" });
    const h = scoringMock.requests[0]!.headers;
    const ts = h.get("x-timestamp")!;
    const expected = createHmac("sha256", "x".repeat(32)).update(`${ts}.req-1`).digest("hex");
    expect(h.get("x-signature")).toBe(`sha256=${expected}`);
    expect(Math.abs(Number(ts) - Date.now() / 1000)).toBeLessThan(5);
  });

  it("sends the audio, mime type, expected text and level", async () => {
    await scoringClient.score(input);
    expect(scoringMock.requests[0]).toMatchObject({
      audioBytes: 2048,
      fields: { mime_type: "audio/webm", expected_text: "That makes sense.", level: "B1" },
    });
  });

  it("returns a parsed score", async () => {
    const out = await scoringClient.score(input);
    expect(out.kind).toBe("scored");
    if (out.kind === "scored") expect(out.result.weakest_sounds).toEqual(["ð", "s"]);
  });

  it("maps 422 to an unusable outcome (not an attempt)", async () => {
    scoringMock.mode = "unusable";
    await expect(scoringClient.score(input)).resolves.toEqual({
      kind: "unusable",
      reason: "no_speech",
    });
  });

  it("maps 503 to AppError unavailable", async () => {
    scoringMock.mode = "down";
    const err = await scoringClient.score(input).catch((e: unknown) => e);
    expect((err as AppError).code).toBe("unavailable");
  });

  it("phonemizes texts in order", async () => {
    await expect(scoringClient.phonemize(["A", "B"])).resolves.toEqual(["/a/", "/b/"]);
  });
});
