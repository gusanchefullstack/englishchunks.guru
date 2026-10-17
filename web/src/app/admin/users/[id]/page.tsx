import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { UserActions } from "@/components/admin/user-actions";
import { adminOrNotFound } from "@/lib/admin-guard";
import { getUserDetail } from "@/lib/domain/admin-users";
import { AppError } from "@/lib/errors";

export const metadata: Metadata = { title: "User · Admin" };
const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

export default function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-96 animate-pulse rounded-2xl" />}
    >
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: PageProps<"/admin/users/[id]">["params"] }) {
  const { id } = await params;
  const admin = await adminOrNotFound();
  let d;
  try {
    d = await getUserDetail(id);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const { user: u, subscription: s } = d;
  const rows: [string, string][] = [
    ["Email", u.email],
    ["Username", u.username ?? "—"],
    ["Role", u.role],
    [
      "Status",
      u.banned
        ? `suspended (${u.banReason ?? "no reason"})`
        : u.emailVerified
          ? "active"
          : "unverified",
    ],
    ["Signed up", fmt(u.createdAt)],
    ["Last active", fmt(u.lastActiveAt)],
    ["Completed sessions", String(d.stats.sessions)],
    ["Points / streak", `${u.totalPoints} pts · ${u.currentStreak} days`],
  ];
  const sub: [string, string][] = [
    ["Plan", s.tier],
    ["Status", s.status.replace("_", " ")],
    ["Early tester", u.earlyTester ? "yes" : "no"],
    ["Trial ends", fmt(s.trialEndsAt)],
    ["Renews", s.cancelAtPeriodEnd ? `cancels ${fmt(s.renewsAt)}` : fmt(s.renewsAt)],
    [
      "Payment method",
      s.paymentMethod
        ? `${s.paymentMethod.brand} •••• ${s.paymentMethod.last4} · exp ${s.paymentMethod.expMonth}/${s.paymentMethod.expYear}`
        : "none on file",
    ],
  ];
  return (
    <div>
      <Link href="/admin/users" className="text-sm font-bold">
        ← Users
      </Link>
      <h1 className="mt-2 text-[34px] leading-tight tracking-[-1px]">{u.name}</h1>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section aria-labelledby="acct" className="bg-card rounded-2xl border p-5">
          <h2 id="acct" className="text-xl">
            Account
          </h2>
          <dl className="mt-3 grid grid-cols-[150px_1fr] gap-y-2 text-sm">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </section>
        <section aria-labelledby="subs" className="bg-card rounded-2xl border p-5">
          <h2 id="subs" className="text-xl">
            Subscription
          </h2>
          <dl className="mt-3 grid grid-cols-[150px_1fr] gap-y-2 text-sm">
            {sub.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="capitalize">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section aria-labelledby="manage" className="bg-card mt-5 rounded-2xl border p-5">
        <h2 id="manage" className="mb-4 text-xl">
          Manage
        </h2>
        <UserActions id={u.id} level={u.level} banned={u.banned} isSelf={u.id === admin.id} />
      </section>
    </div>
  );
}
