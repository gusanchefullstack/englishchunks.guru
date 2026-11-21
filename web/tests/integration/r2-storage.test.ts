import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/media/[...key]/route";
import { setTestEnv } from "@/lib/env";
import { setStorage, storage } from "@/lib/providers/storage";

const HOST = "https://bucket.00000000000000000000000000000000.r2.cloudflarestorage.com/";

beforeAll(() => {
  setTestEnv();
  setStorage(undefined); // real R2 adapter (signing is local, no network)
});
afterAll(() => {
  vi.useRealTimers();
  setStorage(undefined);
});

const get = (key: string) =>
  GET(new Request(`https://x.test/media/${key}`), {
    params: Promise.resolve({ key: key.split("/") }),
  });

describe("R2 storage", () => {
  it("signs URLs on the private bucket, stable within the hour", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-21T10:05:00Z") });
    const a = await storage().signedGetUrl("tts/shared/abc.mp3", 600);
    vi.setSystemTime(new Date("2026-11-21T10:55:00Z"));
    const b = await storage().signedGetUrl("tts/shared/abc.mp3", 600);
    vi.setSystemTime(new Date("2026-11-21T11:01:00Z"));
    const c = await storage().signedGetUrl("tts/shared/abc.mp3", 600);
    vi.useRealTimers();
    expect(a.startsWith(`${HOST}tts/shared/abc.mp3?`)).toBe(true);
    expect(a).toContain("X-Amz-Signature=");
    expect(b).toBe(a); // browser cache hit
    expect(c).not.toBe(a); // new window
    // valid for the rest of the window plus the requested lifetime
    expect(new URL(a).searchParams.get("X-Amz-Expires")).toBe(String(3600 + 600));
  });

  it("publicUrl is a stable app path", () => {
    expect(storage().publicUrl("avatars/x.webp")).toBe("/media/avatars/x.webp");
  });

  it("/media redirects public keys to a signed URL, cacheable", async () => {
    const res = await get("avatars/0b1c.webp");
    expect(res.status).toBe(302);
    expect(res.headers.get("location")!.startsWith(`${HOST}avatars/0b1c.webp?`)).toBe(true);
    expect(res.headers.get("cache-control")).toMatch(/s-maxage=\d+/);
  });

  it("/media never serves per-learner audio or odd keys", async () => {
    for (const key of [
      "tts/u/user1/abc.mp3",
      "tts/shared/abc.mp3",
      "avatars/../tts/u/x.mp3",
      "x",
    ]) {
      expect((await get(key)).status, key).toBe(404);
    }
  });
});
