import type { Db } from "../client";
import { appSetting, voice } from "../schema";

/**
 * American-English voices (FR-006: ≥4, mixed genders). Provider ids are ElevenLabs premade
 * voices; verify them in the ElevenLabs voice library before production.
 */
export const VOICES = [
  {
    id: "us-mina-warm",
    providerVoiceId: "21m00Tcm4TlvDq8ikWAM",
    label: "Mina · Warm",
    gender: "female",
  },
  {
    id: "us-sam-calm",
    providerVoiceId: "pNInz6obpgDQGcFmaJgB",
    label: "Sam · Calm",
    gender: "male",
  },
  {
    id: "us-ava-bright",
    providerVoiceId: "EXAVITQu4vr4xnSDxMaL",
    label: "Ava · Bright",
    gender: "female",
  },
  {
    id: "us-leo-friendly",
    providerVoiceId: "TxGEqnHWrfWFTfGW9XjX",
    label: "Leo · Friendly",
    gender: "male",
  },
] as const;

export const DEFAULT_VOICE_ID = VOICES[0].id;

export async function seedBase(db: Db) {
  await db
    .insert(voice)
    .values([...VOICES])
    .onConflictDoNothing();
  await db.insert(appSetting).values({ id: 1 }).onConflictDoNothing();
}
