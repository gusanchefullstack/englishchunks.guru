import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cefrLevels, themes, user, voice, type CefrLevel } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { isValidTimeZone } from "./time";

/** FR-003: CEFR directly, or a simple band mapped to a CEFR level. */
export const LevelChoice = z.enum([...cefrLevels, "beginner", "intermediate", "advanced"]);
const BAND_TO_CEFR: Record<string, CefrLevel> = {
  beginner: "A2",
  intermediate: "B1",
  advanced: "C1",
};

export function toCefr(choice: z.infer<typeof LevelChoice>): CefrLevel {
  return BAND_TO_CEFR[choice] ?? (choice as CefrLevel);
}

/** Level changes apply from the next daily chunk: today's session keeps its chunk (spec edge case). */
export async function setLevel(userId: string, choice: z.infer<typeof LevelChoice>) {
  const level = toCefr(choice);
  await db().update(user).set({ level }).where(eq(user.id, userId));
  return level;
}

export async function confirmAge(userId: string) {
  await db().update(user).set({ ageConfirmedAt: new Date() }).where(eq(user.id, userId));
}

export const ProfileUpdate = z
  .object({
    displayName: z.string().trim().min(1).max(40),
    motherTongue: z
      .string()
      .regex(/^[a-z]{2}$/)
      .nullable(),
    timeZone: z.string().refine(isValidTimeZone, "Unknown time zone"),
    voiceId: z.string().min(1),
    theme: z.enum(themes),
    rankingVisible: z.boolean(),
    remindersEnabled: z.boolean(),
    reminderHour: z.int().min(0).max(23),
  })
  .partial();

/** FR-004: profile and preferences. */
export async function updateProfile(userId: string, input: z.infer<typeof ProfileUpdate>) {
  if (input.voiceId) {
    const [v] = await db()
      .select()
      .from(voice)
      .where(and(eq(voice.id, input.voiceId), eq(voice.active, true)));
    if (!v) throw new AppError("validation", "Please choose one of the available voices.");
  }
  const { displayName, ...rest } = input;
  const [row] = await db()
    .update(user)
    .set({ ...rest, ...(displayName !== undefined ? { name: displayName } : {}) })
    .where(eq(user.id, userId))
    .returning();
  return row!;
}

export async function getProfile(userId: string) {
  const [u] = await db().select().from(user).where(eq(user.id, userId));
  if (!u) throw new AppError("not_found", "Profile not found.");
  const voices = await db().select().from(voice).where(eq(voice.active, true));
  return { user: u, voices };
}
