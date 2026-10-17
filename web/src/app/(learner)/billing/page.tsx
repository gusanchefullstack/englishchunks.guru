import type { Metadata } from "next";
import { Suspense } from "react";
import { ManageButton, SubscribeButton } from "@/components/billing/billing-actions";
import { getBillingView } from "@/lib/domain/subscription";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Plan & billing" };

const TIERS = [
  { tier: "basic", name: "Basic", price: 7, practices: 1 },
  { tier: "standard", name: "Standard", price: 9, practices: 3 },
  { tier: "premium", name: "Premium", price: 11, practices: 5 },
] as const;

const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "";

export default function BillingPage({ searchParams }: PageProps<"/billing">) {
  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Your plan</p>
      <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Plan &amp; billing</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />}
      >
        <Content searchParams={searchParams as Promise<{ checkout?: string }>} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ checkout?: string }> }) {
  const { checkout } = await searchParams;
  const u = await learnerOrRedirect();
  const b = await getBillingView(u.id);
  const daysLeft = b.trialDaysLeft;
  const paid = b.status === "active" || b.status === "past_due";

  let summary: string;
  if (!b.billingActive)
    summary = "Everything is free while we're testing. You're on Basic: 1 practice a day.";
  else if (b.status === "free_basic")
    summary = b.earlyTester
      ? "Thanks for being an early tester — Basic stays free for you, forever."
      : "You're on free Basic.";
  else if (b.status === "trialing")
    summary = `Free trial: ${daysLeft} day${daysLeft === 1 ? "" : "s"} left. Choose a plan to keep practicing after it ends.`;
  else if (b.status === "past_due")
    summary = "We couldn't take your last payment. Update your payment method to keep your plan.";
  else if (b.status === "active")
    summary = b.cancelAtPeriodEnd
      ? `Your ${b.tier} plan ends on ${fmt(b.renewsAt)}.`
      : `You're on ${b.tier}. Renews on ${fmt(b.renewsAt)}.`;
  else summary = "Your trial has ended. Choose a plan to keep practicing — your progress is saved.";

  return (
    <div className="mt-6 grid gap-6">
      {checkout === "success" ? (
        <p role="status" className="bg-tag-level text-tag-level-foreground rounded-xl p-4">
          Thanks! Your plan will be active in a moment.
        </p>
      ) : null}
      <section aria-labelledby="status-title" className="bg-card rounded-[20px] border p-6">
        <h2 id="status-title" className="text-xl capitalize">
          {paid ? `${b.tier} plan` : b.status === "trialing" ? "Free trial" : "Basic"}
        </h2>
        <p className="text-muted-foreground mt-1">{summary}</p>
        {b.billingActive && b.hasCustomer ? (
          <div className="mt-4">
            <ManageButton />
          </div>
        ) : null}
      </section>
      <ul className="grid gap-4 md:grid-cols-3">
        {TIERS.map((t) => {
          const current = paid && b.tier === t.tier;
          return (
            <li key={t.tier} className="bg-card flex flex-col rounded-[20px] border p-6">
              <h3 className="text-lg font-bold">{t.name}</h3>
              <p className="mt-1">
                <span className="text-3xl font-bold">${t.price}</span>{" "}
                <span className="text-muted-foreground text-sm">/ month</span>
              </p>
              <p className="text-muted-foreground mt-2 flex-1 text-sm">
                {t.practices} practice{t.practices > 1 ? "s" : ""} a day
                {t.tier === "premium" ? " · daily Guru conversation (coming soon)" : ""}
              </p>
              <div className="mt-4">
                {!b.billingActive ? (
                  <p className="bg-muted rounded-xl px-4 py-2.5 text-center text-sm font-bold">
                    {t.tier === "basic" ? "Free for now" : "Coming soon"}
                  </p>
                ) : current ? (
                  <p className="bg-tag-level text-tag-level-foreground rounded-xl px-4 py-2.5 text-center text-sm font-bold">
                    Current plan
                  </p>
                ) : paid ? (
                  <ManageButton />
                ) : (
                  <SubscribeButton tier={t.tier} label={`Choose ${t.name}`} />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-muted-foreground text-xs">
        Payments are handled by Stripe. We never see or store your card details.
      </p>
    </div>
  );
}
