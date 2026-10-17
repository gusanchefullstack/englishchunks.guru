import { timingSafeEqual } from "node:crypto";
import { env } from "@/lib/env";

/** Bearer CRON_SECRET check (Droplet timer and Vercel Cron). */
export function isCronAuthorized(request: Request) {
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${env().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
