import "server-only";
import { headers } from "next/headers";
import { consume } from "@/lib/domain/caps";
import { e2eMode } from "@/lib/e2e";

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). */
export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

/**
 * Fixed-window rate limit for public server actions (they call Better Auth's API directly, so
 * its HTTP rate limiter doesn't apply). Throws `limit_reached`. Off in offline E2E mode only.
 */
export async function rateLimit(name: string, max: number, windowSeconds = 60, key?: string) {
  if (e2eMode()) return;
  const id = key ?? (await clientIp());
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  await consume(
    `rl:${name}:${id}:${bucket}`,
    max,
    "Too many attempts. Please wait a minute and try again.",
  );
}
