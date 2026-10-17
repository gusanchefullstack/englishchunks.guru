import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { adminOrNotFound } from "@/lib/admin-guard";
import { getDashboard } from "@/lib/domain/admin-dashboard";

export const metadata: Metadata = { title: "Admin" };

export default function AdminHome() {
  return (
    <>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Dashboard</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />}
      >
        <Dashboard />
      </Suspense>
    </>
  );
}

async function Dashboard() {
  await adminOrNotFound();
  const d = await getDashboard();
  const tiles = [
    { label: "Accounts", value: d.users },
    { label: "Active (verified)", value: d.activeUsers },
    { label: "Sessions today (UTC)", value: d.sessionsToday },
    { label: "Pending submissions", value: d.pendingSubmissions, href: "/admin/submissions" },
  ];
  return (
    <>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label} className="bg-card rounded-2xl border p-5">
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              {t.label}
            </p>
            <p className="mt-1 text-3xl font-bold">{t.value.toLocaleString("en-US")}</p>
            {t.href ? (
              <Link href={t.href} className="text-sm">
                Review
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
      <section
        aria-labelledby="usage-title"
        className="bg-card mt-6 overflow-x-auto rounded-2xl border p-5"
      >
        <h2 id="usage-title" className="text-xl">
          Usage (last 7 days)
        </h2>
        <p className="text-muted-foreground text-sm">
          AI and audio spend drivers (constitution V).
        </p>
        <table className="mt-4 w-full min-w-[520px] text-left text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 font-normal">
                Day
              </th>
              <th scope="col" className="py-2 font-normal">
                LLM tokens in
              </th>
              <th scope="col" className="py-2 font-normal">
                LLM tokens out
              </th>
              <th scope="col" className="py-2 font-normal">
                TTS characters
              </th>
              <th scope="col" className="py-2 font-normal">
                Scoring requests
              </th>
            </tr>
          </thead>
          <tbody>
            {d.usage.length ? (
              d.usage.map((u) => (
                <tr key={u.day} className="border-t">
                  <td className="py-2">{u.day}</td>
                  <td className="py-2">{u.llmIn.toLocaleString("en-US")}</td>
                  <td className="py-2">{u.llmOut.toLocaleString("en-US")}</td>
                  <td className="py-2">{u.ttsChars.toLocaleString("en-US")}</td>
                  <td className="py-2">{u.scoring.toLocaleString("en-US")}</td>
                </tr>
              ))
            ) : (
              <tr className="border-t">
                <td colSpan={5} className="text-muted-foreground py-3">
                  No usage recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
