import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BillingSwitch } from "@/components/admin/billing-switch";
import { db } from "@/db/client";
import { appSetting } from "@/db/schema";
import { adminOrNotFound } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "Settings · Admin" };

export default function SettingsPage() {
  return (
    <>
      <h1 className="mb-6 text-[34px] leading-tight tracking-[-1px]">Settings</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted h-64 animate-pulse rounded-2xl" />}
      >
        <Content />
      </Suspense>
    </>
  );
}

async function Content() {
  await adminOrNotFound();
  const [s] = await db().select().from(appSetting).limit(1);
  return (
    <div className="grid gap-5">
      <section aria-labelledby="billing-title" className="bg-card rounded-2xl border p-5">
        <h2 id="billing-title" className="mb-3 text-xl">
          Paid billing (FR-054)
        </h2>
        <BillingSwitch active={s?.billingActive ?? false} />
        {s?.billingChangedAt ? (
          <p className="text-muted-foreground mt-3 text-xs">
            Last changed {new Date(s.billingChangedAt).toLocaleString("en-US")}
          </p>
        ) : null}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-bold">
            Go-live checklist (before real charges)
          </summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Demo account: subscribe, renew (test clock) and cancel pass in Stripe test mode.
            </li>
            <li>Vercel project upgraded from Hobby to Pro (Hobby is non-commercial).</li>
            <li>
              Live restricted key (rk_live_…), webhook secret and price ids set in Vercel env only.
            </li>
            <li>Stripe Tax registration decided for the countries you sell to.</li>
          </ol>
        </details>
      </section>
      <section aria-labelledby="cap-title" className="bg-card rounded-2xl border p-5">
        <h2 id="cap-title" className="text-xl">
          Account cap
        </h2>
        <p className="text-muted-foreground mt-1 text-sm">
          Currently {s?.accountCap ?? 200} learner accounts while billing is off.
        </p>
        <Link href="/admin/waitlist" className="mt-2 inline-block text-sm font-bold">
          Manage cap &amp; waitlist
        </Link>
      </section>
    </div>
  );
}
