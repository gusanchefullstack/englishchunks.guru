import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { DEFAULT_VOICE_ID } from "@/db/seed/base";
import { requireVerifiedUser } from "@/lib/authz";
import { getAudioUrl, parseRef } from "@/lib/domain/tts-service";
import { errorResponse } from "@/lib/errors";

/** GET ?ref=chunk:<id>|example:<id>|sentence:<id> → 302 to the audio (FR-012). Raw text is never accepted. */
export async function GET(request: Request) {
  try {
    const learner = await requireVerifiedUser();
    const ref = parseRef(new URL(request.url).searchParams.get("ref"));
    const [u] = await db()
      .select({ voiceId: user.voiceId })
      .from(user)
      .where(eq(user.id, learner.id));
    const url = await getAudioUrl(learner.id, u?.voiceId ?? DEFAULT_VOICE_ID, ref);
    return Response.redirect(url, 302);
  } catch (err) {
    return errorResponse(err);
  }
}
