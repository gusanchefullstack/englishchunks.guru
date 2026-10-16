import "server-only";
import { env } from "@/lib/env";
import { e2eMode } from "@/lib/e2e";
import { AppError } from "@/lib/errors";

/** Text-to-speech (peripheral, closed service — constitution I). Swappable for open TTS. */
export interface TtsProvider {
  readonly model: string;
  synthesize(
    text: string,
    providerVoiceId: string,
  ): Promise<{ audio: Uint8Array; contentType: string }>;
}

class ElevenLabsTts implements TtsProvider {
  get model() {
    return env().ELEVENLABS_MODEL;
  }

  async synthesize(text: string, providerVoiceId: string) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(providerVoiceId)}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: {
          "xi-api-key": env().ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({ text, model_id: this.model }),
        signal: AbortSignal.timeout(15_000),
      },
    ).catch(() => null);
    if (!res?.ok) throw new AppError("unavailable", "Audio is not available right now.");
    return { audio: new Uint8Array(await res.arrayBuffer()), contentType: "audio/mpeg" };
  }
}

let provider: TtsProvider | undefined;
const fakeTts: TtsProvider = {
  model: "e2e-fake",
  synthesize: async () => ({
    audio: new Uint8Array([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 0]),
    contentType: "audio/mpeg",
  }),
};

export function tts(): TtsProvider {
  provider ??= e2eMode() ? fakeTts : new ElevenLabsTts();
  return provider;
}
export function setTts(next: TtsProvider | undefined) {
  provider = next;
}
