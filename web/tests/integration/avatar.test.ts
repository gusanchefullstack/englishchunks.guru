import { eq } from "drizzle-orm";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { user } from "@/db/schema";
import { setAvatar, sniffImage } from "@/lib/domain/avatar";
import { MemoryStorage, setStorage } from "@/lib/providers/storage";
import { createTestDb } from "../helpers/db";
import { createLearner } from "../helpers/fixtures";

let db: Db;
let close: () => Promise<void>;
const store = new MemoryStorage();
beforeAll(async () => {
  ({ db, close } = await createTestDb());
  setStorage(store);
});
afterAll(async () => {
  setStorage(undefined);
  await close();
});

async function jpegWithGps(width = 1200, height = 800) {
  return sharp({ create: { width, height, channels: 3, background: { r: 93, g: 253, b: 203 } } })
    .jpeg()
    .withExif({
      IFD0: { Make: "TestCam" },
      GPS: { GPSLatitudeRef: "N", GPSLatitude: "40/1 26/1 46/1" },
    } as never)
    .toBuffer();
}

describe("profile picture (FR-005)", () => {
  it("sniffs formats by magic bytes, not names", async () => {
    expect(sniffImage(await jpegWithGps(10, 10))).toBe("jpeg");
    expect(sniffImage(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("normalizes to a 512×512 WebP with no EXIF/GPS and replaces the old picture", async () => {
    const u = await createLearner(db);
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const first = await setAvatar(u.id, input);
    const [row] = await db.select().from(user).where(eq(user.id, u.id));
    const stored = store.objects.get(row!.imageKey!)!;
    const meta = await sharp(stored.body).metadata();
    expect(meta).toMatchObject({ format: "webp", width: 512, height: 512 });
    expect(meta.exif).toBeUndefined();
    expect(stored.visibility).toBe("public");
    expect(first.imageUrl).toBe(`https://cdn.test/${row!.imageKey}`);

    await setAvatar(u.id, await jpegWithGps(600, 600));
    expect(store.objects.has(row!.imageKey!)).toBe(false); // old picture deleted
  });

  it("rejects non-images and files over 5 MB", async () => {
    const u = await createLearner(db);
    await expect(setAvatar(u.id, new TextEncoder().encode("not an image"))).rejects.toMatchObject({
      code: "validation",
    });
    await expect(setAvatar(u.id, new Uint8Array(5 * 1024 * 1024 + 1))).rejects.toMatchObject({
      code: "validation",
    });
  });
});
