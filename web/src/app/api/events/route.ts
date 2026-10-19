import { requireVerifiedUser } from "@/lib/authz";
import { ClientEventInput, recordClientEvent } from "@/lib/domain/practice-events";
import { errorResponse, parseInput } from "@/lib/errors";

/** POST JSON: one practice diagnostic from the browser (FR-074) → 204. */
export async function POST(request: Request) {
  try {
    const user = await requireVerifiedUser();
    const input = parseInput(ClientEventInput, await request.json().catch(() => null));
    await recordClientEvent(user.id, input);
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
