import "server-only";
import { createHash } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { audioClip, chunk, chunkExample, practiceSession, voice, writingResult } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { storage } from "@/lib/providers/storage";
import { tts } from "@/lib/providers/tts";
import { recordUsage } from "./usage";

export type TtsRef = { kind: "chunk" | "example" | "sentence"; id: string };

const UUID = /^[0-9a-f-]{36}$/i;

export function parseRef(raw: string | null): TtsRef {
  const m = raw?.match(/^(chunk|example|sentence):(.+)$/);
  if (!m || !UUID.test(m[2]!)) throw new AppError("validation", "Invalid audio reference.");
  return { kind: m[1] as TtsRef["kind"], id: m[2]! };
}

const practicable = and(
  eq(chunk.status, "active"),
  inArray(chunk.auditStatus, ["passed", "admin_approved"]),
);

/** Resolves a reference to text; learner sentences are only visible to their author. */
async function resolveText(
  userId: string,
  ref: TtsRef,
): Promise<{ text: string; ownerId: string | null }> {
  const d = db();
  if (ref.kind === "chunk") {
    const [r] = await d
      .select({ text: chunk.text })
      .from(chunk)
      .where(and(eq(chunk.id, ref.id), practicable));
    if (r) return { text: r.text, ownerId: null };
  } else if (ref.kind === "example") {
    const [r] = await d
      .select({ text: chunkExample.text })
      .from(chunkExample)
      .innerJoin(chunk, eq(chunk.id, chunkExample.chunkId))
      .where(and(eq(chunkExample.id, ref.id), practicable));
    if (r) return { text: r.text, ownerId: null };
  } else {
    const [r] = await d
      .select({ text: writingResult.corrected })
      .from(writingResult)
      .innerJoin(practiceSession, eq(practiceSession.id, writingResult.sessionId))
      .where(and(eq(writingResult.id, ref.id), eq(practiceSession.userId, userId)));
    if (r && r.text !== "[removed]") return { text: r.text, ownerId: userId };
  }
  throw new AppError("not_found", "Audio not found.");
}

const normalize = (t: string) => t.trim().replace(/\s+/g, " ");

/**
 * Returns a playable URL, generating audio only on first request (FR-012) and reusing it after.
 * A row lock on the cache entry serializes concurrent first plays (research R9).
 */
export async function getAudioUrl(userId: string, voiceId: string, ref: TtsRef): Promise<string> {
  const { text, ownerId } = await resolveText(userId, ref);
  const d = db();
  const [v] = await d
    .select()
    .from(voice)
    .where(and(eq(voice.id, voiceId), eq(voice.active, true)));
  if (!v) throw new AppError("validation", "Unknown voice.");
  const provider = tts();
  const keyParts = [normalize(text), v.providerVoiceId, provider.model, ownerId ?? "shared"];
  const cacheKey = createHash("sha256").update(keyParts.join("\u0000")).digest("hex");
  const storageKey = ownerId ? `tts/u/${ownerId}/${cacheKey}.mp3` : `tts/shared/${cacheKey}.mp3`;

  const ready = await d.transaction(async (tx) => {
    await tx
      .insert(audioClip)
      .values({ cacheKey, ownerId, text: normalize(text), voiceId: v.id, storageKey })
      .onConflictDoNothing();
    const [row] = await tx
      .select()
      .from(audioClip)
      .where(eq(audioClip.cacheKey, cacheKey))
      .for("update");
    if (row!.status === "ready") return row!;
    const { audio, contentType } = await provider.synthesize(normalize(text), v.providerVoiceId);
    await storage().put(storageKey, audio, {
      contentType,
      visibility: ownerId ? "private" : "public",
      cacheControl: ownerId ? "private, max-age=3600" : undefined,
    });
    const [updated] = await tx
      .update(audioClip)
      .set({ status: "ready", byteSize: audio.byteLength })
      .where(eq(audioClip.cacheKey, cacheKey))
      .returning();
    return { ...updated!, generated: true };
  });
  // Outside the transaction: never hold the row lock while using another connection.
  if ("generated" in ready)
    await recordUsage("tts_chars", normalize(text).length).catch(() => undefined);
  return ready.ownerId
    ? storage().signedGetUrl(ready.storageKey, 600)
    : storage().publicUrl(ready.storageKey);
}
