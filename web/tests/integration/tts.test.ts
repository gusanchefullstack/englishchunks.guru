import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { audioClip, chunk, chunkExample, practiceSession, writingResult } from "@/db/schema";
import { DEFAULT_VOICE_ID } from "@/db/seed/base";
import { startDailySession } from "@/lib/domain/session-engine";
import { getAudioUrl, parseRef } from "@/lib/domain/tts-service";
import { setTestEnv } from "@/lib/env";
import { MemoryStorage, setStorage } from "@/lib/providers/storage";
import { setTts } from "@/lib/providers/tts";
import { createTestDb } from "../helpers/db";
import { createLearner, seedAll } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
const store = new MemoryStorage();
let synthCalls = 0;

beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  await seedAll(db);
  setStorage(store);
  setTts({
    model: "eleven_flash_v2_5",
    synthesize: async () => {
      synthCalls++;
      return { audio: new Uint8Array([1, 2, 3]), contentType: "audio/mpeg" };
    },
  });
});
afterAll(async () => {
  setTts(undefined);
  setStorage(undefined);
  await close();
});

describe("TTS by reference (FR-012, R9)", () => {
  it("generates shared chunk audio once and reuses it", async () => {
    const u = await createLearner(db);
    const [c] = await db.select().from(chunk).limit(1);
    const before = synthCalls;
    const url1 = await getAudioUrl(u.id, DEFAULT_VOICE_ID, { kind: "chunk", id: c!.id });
    const url2 = await getAudioUrl(u.id, DEFAULT_VOICE_ID, { kind: "chunk", id: c!.id });
    expect(url1).toBe(url2);
    expect(url1).toMatch(/^https:\/\/cdn\.test\/tts\/shared\//);
    expect(synthCalls - before).toBe(1);
  });

  it("deduplicates concurrent first plays", async () => {
    const u = await createLearner(db);
    const [e] = await db.select().from(chunkExample).limit(1);
    const before = synthCalls;
    await Promise.all(
      Array.from({ length: 5 }, () =>
        getAudioUrl(u.id, DEFAULT_VOICE_ID, { kind: "example", id: e!.id }),
      ),
    );
    expect(synthCalls - before).toBe(1);
  });

  it("stores a learner's sentence audio privately under tts/u/<userId>/ with a signed URL", async () => {
    const u = await createLearner(db);
    const ctx = {
      userId: u.id,
      level: "B1" as const,
      timeZone: "UTC",
      now: new Date("2026-10-16T10:00:00Z"),
    };
    const s = await startDailySession(ctx);
    const [w] = await db
      .insert(writingResult)
      .values({
        sessionId: s.id,
        position: 1,
        original: "o",
        corrected: "My sentence makes sense.",
        usageGrade: 90,
        grammarGrade: 90,
        usesChunk: true,
        explanation: "Good.",
      })
      .returning();
    const url = await getAudioUrl(u.id, DEFAULT_VOICE_ID, { kind: "sentence", id: w!.id });
    expect(url).toMatch(new RegExp(`^https://signed\\.test/tts/u/${u.id}/`));
    const [clip] = await db.select().from(audioClip).where(eq(audioClip.ownerId, u.id));
    expect(store.objects.get(clip!.storageKey)?.visibility).toBe("private");

    const other = await createLearner(db);
    await expect(
      getAudioUrl(other.id, DEFAULT_VOICE_ID, { kind: "sentence", id: w!.id }),
    ).rejects.toMatchObject({ code: "not_found" });
    await db.delete(practiceSession).where(eq(practiceSession.id, s.id));
  });

  it("only accepts references, never raw text", () => {
    expect(() => parseRef("text:hello")).toThrow();
    expect(() => parseRef("Hello world")).toThrow();
    expect(() => parseRef(null)).toThrow();
    expect(parseRef("chunk:0199f0a2-0000-7000-8000-000000000000").kind).toBe("chunk");
  });
});
