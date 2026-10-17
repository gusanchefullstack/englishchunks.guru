import { z } from "zod";
import { requireLearner } from "@/lib/authz";
import { createCheckout } from "@/lib/domain/subscription";
import { errorResponse, parseInput } from "@/lib/errors";

/** POST { tier } → { url } Stripe-hosted Checkout (409 billing_inactive while billing is off). */
export async function POST(request: Request) {
  try {
    const u = await requireLearner();
    const { tier } = parseInput(
      z.object({ tier: z.enum(["basic", "standard", "premium"]) }),
      await request.json().catch(() => ({})),
    );
    return Response.json(await createCheckout(u.id, tier));
  } catch (err) {
    return errorResponse(err);
  }
}
