import { processWebhook } from "@/lib/domain/stripe-webhook";

/** Stripe webhooks: raw body + Stripe-Signature (never parse JSON before verifying). */
export async function POST(request: Request) {
  const { status } = await processWebhook(
    await request.text(),
    request.headers.get("stripe-signature"),
  );
  return new Response(null, { status });
}
