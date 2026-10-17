import { createHmac, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { env } from "@/lib/env";

const b64 = (b: Buffer) => b.toString("base64url");
const sign = (userId: string) =>
  b64(createHmac("sha256", env().UNSUBSCRIBE_SECRET).update(`unsubscribe:${userId}`).digest());

/** Signed, non-expiring token for one-click unsubscribe (works without signing in). */
export function unsubscribeToken(userId: string) {
  return `${b64(Buffer.from(userId))}.${sign(userId)}`;
}

export function verifyUnsubscribeToken(token: string | null | undefined): string | null {
  const [idPart, sig] = (token ?? "").split(".");
  if (!idPart || !sig) return null;
  const userId = Buffer.from(idPart, "base64url").toString("utf8");
  const expected = Buffer.from(sign(userId));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}

export async function unsubscribeReminders(token: string | null | undefined) {
  const userId = verifyUnsubscribeToken(token);
  if (!userId) return false;
  await db().update(user).set({ remindersEnabled: false }).where(eq(user.id, userId));
  return true;
}
