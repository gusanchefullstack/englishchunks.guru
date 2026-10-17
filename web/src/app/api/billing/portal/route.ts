import { requireVerifiedUser } from "@/lib/authz";
import { createPortal } from "@/lib/domain/subscription";
import { errorResponse } from "@/lib/errors";

/** POST → { url } Stripe Customer Portal (plan changes, payment method, cancellation). */
export async function POST() {
  try {
    const u = await requireVerifiedUser();
    return Response.json(await createPortal(u.id));
  } catch (err) {
    return errorResponse(err);
  }
}
