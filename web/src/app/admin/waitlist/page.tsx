import type { Metadata } from "next";
import { Suspense } from "react";
import { WaitlistManager } from "@/components/admin/waitlist-manager";
import { adminOrNotFound } from "@/lib/admin-guard";
import { accountCount, listWaitlist } from "@/lib/domain/signup-gate";
import { db } from "@/db/client";
import { appSetting } from "@/db/schema";

export const metadata: Metadata = { title: "Waitlist · Admin" };

export default function WaitlistAdminPage() {
  return (
    <>
      <h1 className="mb-6 text-[34px] leading-tight tracking-[-1px]">Waitlist &amp; account cap</h1>
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
  const [entries, count, [setting]] = await Promise.all([
    listWaitlist(),
    accountCount(),
    db().select().from(appSetting).limit(1),
  ]);
  return (
    <WaitlistManager
      entries={entries.map((e) => ({
        id: e.id,
        email: e.email,
        status: e.status,
        inviteExpiresAt: e.inviteExpiresAt,
        createdAt: e.createdAt,
      }))}
      cap={setting?.accountCap ?? 200}
      count={count}
      billingActive={setting?.billingActive ?? false}
    />
  );
}
