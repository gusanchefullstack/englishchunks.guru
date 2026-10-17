import { http, HttpResponse } from "msw";
import Stripe from "stripe";
import { server } from "../mocks/server";

export const WEBHOOK_SECRET = "whsec_test_secret";
export const PRICES = {
  basic: "price_basic",
  standard: "price_standard",
  premium: "price_premium",
};

export const stripeTestEnv = {
  STRIPE_SECRET_KEY: "rk_test_x",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_BASIC: PRICES.basic,
  STRIPE_PRICE_STANDARD: PRICES.standard,
  STRIPE_PRICE_PREMIUM: PRICES.premium,
};

/** Subscription JSON in the dahlia shape (period on items). */
export function fakeSubscription(o: {
  id: string;
  customer: string;
  status: string;
  price: string;
  cancelAtPeriodEnd?: boolean;
  userId?: string;
}) {
  return {
    id: o.id,
    object: "subscription",
    customer: o.customer,
    status: o.status,
    cancel_at_period_end: o.cancelAtPeriodEnd ?? false,
    metadata: o.userId ? { userId: o.userId } : {},
    default_payment_method: {
      id: "pm_1",
      object: "payment_method",
      card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2029 },
    },
    items: {
      object: "list",
      data: [{ id: "si_1", price: { id: o.price }, current_period_end: 1_793_000_000 }],
    },
  };
}

/** Records Stripe API calls and serves subscriptions from an in-memory map. */
export function mockStripe() {
  const calls: { method: string; path: string; body: string }[] = [];
  const subs = new Map<string, ReturnType<typeof fakeSubscription>>();
  server.use(
    http.all("https://api.stripe.com/*", async ({ request }) => {
      const url = new URL(request.url);
      const body = request.method === "GET" ? "" : await request.text();
      calls.push({ method: request.method, path: url.pathname, body });
      if (url.pathname === "/v1/customers" && request.method === "POST")
        return HttpResponse.json({ id: "cus_new", object: "customer" });
      if (url.pathname === "/v1/checkout/sessions")
        return HttpResponse.json({
          id: "cs_1",
          object: "checkout.session",
          url: "https://checkout.stripe.test/cs_1",
        });
      if (url.pathname === "/v1/billing_portal/sessions")
        return HttpResponse.json({ id: "bps_1", url: "https://billing.stripe.test/p_1" });
      const m = url.pathname.match(/^\/v1\/subscriptions\/(.+)$/);
      if (m && request.method === "GET")
        return subs.has(m[1]!)
          ? HttpResponse.json(subs.get(m[1]!))
          : HttpResponse.json({ error: { message: "nope" } }, { status: 404 });
      return HttpResponse.json(
        { error: { message: `unmocked ${request.method} ${url.pathname}` } },
        { status: 500 },
      );
    }),
  );
  return { calls, subs };
}

export async function signedEvent(
  type: string,
  object: unknown,
  id = `evt_${Math.random().toString(36).slice(2)}`,
) {
  const payload = JSON.stringify({ id, object: "event", type, data: { object } });
  const header = await new Stripe("rk_test_x").webhooks.generateTestHeaderStringAsync({
    payload,
    secret: WEBHOOK_SECRET,
  });
  return { payload, header, id };
}
