import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { AppError } from "@/lib/errors";
import { storage } from "@/lib/providers/storage";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const SIZE = 512;

/** Identify by magic bytes, never by the client-declared type or file name. */
export function sniffImage(b: Uint8Array): "jpeg" | "png" | "webp" | "heic" | null {
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b[0] === 0x89 && ascii(1, 4) === "PNG") return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return "webp";
  if (ascii(4, 8) === "ftyp" && /^(heic|heix|mif1|msf1|hevc)$/.test(ascii(8, 12))) return "heic";
  return null;
}

/**
 * FR-005: validate, auto-orient, strip all metadata (EXIF/GPS), center-crop to 512×512 WebP,
 * store under a random key, and replace the previous picture.
 */
export async function setAvatar(userId: string, bytes: Uint8Array) {
  if (bytes.byteLength > MAX_AVATAR_BYTES)
    throw new AppError("validation", "That picture is larger than 5 MB.");
  const kind = sniffImage(bytes);
  if (!kind) throw new AppError("validation", "Please upload a JPEG, PNG, WebP or HEIC picture.");
  let out: Buffer;
  try {
    // sharp drops metadata by default; .rotate() applies EXIF orientation first.
    out = await sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 })
      .rotate()
      .resize(SIZE, SIZE, { fit: "cover", position: "attention" })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new AppError(
      "validation",
      kind === "heic"
        ? "We couldn't read that HEIC photo. Please choose a JPEG or PNG."
        : "We couldn't read that picture.",
    );
  }
  const key = `avatars/${randomUUID()}.webp`;
  const store = storage();
  await store.put(key, out, { contentType: "image/webp", visibility: "public" });
  const [prev] = await db()
    .select({ imageKey: user.imageKey })
    .from(user)
    .where(eq(user.id, userId));
  await db()
    .update(user)
    .set({ imageKey: key, image: store.publicUrl(key) })
    .where(eq(user.id, userId));
  if (prev?.imageKey) await store.delete(prev.imageKey).catch(() => undefined);
  return { imageUrl: store.publicUrl(key) };
}
