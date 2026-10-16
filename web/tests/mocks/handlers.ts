import { http, HttpResponse, type AnyHandler } from "msw";
import type { ScoreResult } from "@/lib/contracts/scoring";

/** Controls the fake scoring service per test. */
export const scoringMock = {
  mode: "ok" as "ok" | "unusable" | "down",
  score: 78,
  weakest: ["ð", "s"] as string[],
  requests: [] as { headers: Headers; fields: Record<string, string>; audioBytes: number }[],
  reset() {
    this.mode = "ok";
    this.score = 78;
    this.weakest = ["ð", "s"];
    this.requests = [];
  },
};

export function fakeScore(score = scoringMock.score, weakest = scoringMock.weakest): ScoreResult {
  return {
    score,
    components: {
      phoneme_accuracy: score,
      word_accuracy: Math.min(100, score + 5),
      fluency: score - 3,
    },
    sounds: weakest.map((ipa, i) => ({ ipa, score: 40 + i * 10, count: 2 })),
    weakest_sounds: weakest,
    transcript: "that makes sense",
    model_versions: { asr: "parakeet-tdt-0.6b-v2-int8", phonemes: "wav2vec2-lv60-espeak-int8" },
  };
}

export const handlers: AnyHandler[] = [
  // Scoring service (contracts/scoring-service.openapi.yaml)
  http.post("https://scoring.test/v1/score", async ({ request }) => {
    const form = await request.formData();
    const audio = form.get("audio");
    const fields: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;
    scoringMock.requests.push({
      headers: request.headers,
      fields,
      audioBytes: audio instanceof Blob ? audio.size : 0,
    });
    if (scoringMock.mode === "down") return new HttpResponse(null, { status: 503 });
    if (scoringMock.mode === "unusable")
      return HttpResponse.json({ reason: "no_speech" }, { status: 422 });
    return HttpResponse.json(fakeScore());
  }),
  http.post("https://scoring.test/v1/phonemize", async ({ request }) => {
    const { texts } = (await request.json()) as { texts: string[] };
    return HttpResponse.json({ ipa: texts.map((t) => `/${t.toLowerCase()}/`) });
  }),

  // ElevenLabs TTS → small fake MP3 payload
  http.post("https://api.elevenlabs.io/v1/text-to-speech/:voiceId", () =>
    HttpResponse.arrayBuffer(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]).buffer, {
      headers: { "Content-Type": "audio/mpeg" },
    }),
  ),

  // Resend
  http.post("https://api.resend.com/emails", () => HttpResponse.json({ id: "email_test" })),

  // Spaces (S3-compatible)
  http.put("https://bucket.spaces.test/*", () => new HttpResponse(null, { status: 200 })),
  http.delete("https://bucket.spaces.test/*", () => new HttpResponse(null, { status: 204 })),

  // Stripe (individual tests override with server.use)
  http.all("https://api.stripe.com/*", () =>
    HttpResponse.json({ error: { message: "unmocked stripe call" } }, { status: 500 }),
  ),

  // AI Gateway: tests inject mock models; any real call is a bug.
  http.all("https://ai-gateway.vercel.sh/*", () =>
    HttpResponse.json({ error: "real AI Gateway call in tests" }, { status: 500 }),
  ),
];
