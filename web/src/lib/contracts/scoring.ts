import { z } from "zod";

/** Mirrors contracts/scoring-service.openapi.yaml (kept in sync by tests/contract). */
const score = z.int().min(0).max(100);

export const ScoreResult = z.object({
  score,
  components: z.object({ phoneme_accuracy: score, word_accuracy: score, fluency: score }),
  sounds: z.array(z.object({ ipa: z.string(), score, count: z.int().min(1) })),
  weakest_sounds: z.array(z.string()).max(3),
  transcript: z.string(),
  model_versions: z.record(z.string(), z.string()),
});
export type ScoreResult = z.infer<typeof ScoreResult>;

export const unusableReasons = [
  "no_speech",
  "too_short",
  "too_noisy",
  "wrong_content",
  "decode_failed",
] as const;
export const Unusable = z.object({
  reason: z.enum(unusableReasons),
  message: z.string().optional(),
});
export type Unusable = z.infer<typeof Unusable>;

export const PhonemizeResult = z.object({ ipa: z.array(z.string()) });

export const recordingMimeTypes = ["audio/webm", "audio/mp4", "audio/wav", "audio/ogg"] as const;
export type RecordingMimeType = (typeof recordingMimeTypes)[number];
export const MAX_AUDIO_BYTES = 1_048_576;
export const MAX_AUDIO_SECONDS = 15;
