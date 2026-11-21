import { PUBLIC_MEDIA_PREFIXES, storage } from "@/lib/providers/storage";

const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._-]*(\/[A-Za-z0-9][A-Za-z0-9._-]*)*$/;
const CACHE_S = 1800; // well inside the signed URL's validity (≥ 1 h)

/**
 * GET /media/<key> → 302 to a signed R2 URL. Gives public objects (avatars, promo media) a
 * stable address while the bucket stays private. Per-learner audio is never served here.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ key: string[] }> }) {
  const key = (await ctx.params).key.join("/");
  if (!SAFE_KEY.test(key) || !PUBLIC_MEDIA_PREFIXES.some((p) => key.startsWith(p))) {
    return new Response("Not found", { status: 404 });
  }
  const url = await storage().signedGetUrl(key, CACHE_S * 2);
  return new Response(null, {
    status: 302,
    headers: {
      Location: url,
      "Cache-Control": `public, max-age=${CACHE_S}, s-maxage=${CACHE_S}`,
    },
  });
}
