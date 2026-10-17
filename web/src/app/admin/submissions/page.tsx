import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewCard } from "@/components/submissions/review-card";
import { authorizeAdmin, getSessionUser } from "@/lib/authz";
import { pendingSubmissions } from "@/lib/domain/submissions";

export const metadata: Metadata = { title: "Chunk submissions" };

export default function AdminSubmissionsPage() {
  return (
    <main id="main" className="mx-auto max-w-4xl px-5 py-10">
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Admin</p>
      <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Chunk submissions</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />}
      >
        <Queue />
      </Suspense>
    </main>
  );
}

async function Queue() {
  try {
    authorizeAdmin(await getSessionUser()); // FR-050: enforced server-side
  } catch {
    notFound();
  }
  const subs = await pendingSubmissions();
  if (!subs.length)
    return (
      <p className="bg-card mt-6 rounded-2xl border p-6">No submissions waiting for review.</p>
    );
  return (
    <ul className="mt-6 grid gap-4">
      {subs.map((s) => (
        <ReviewCard
          key={s.id}
          sub={{
            id: s.id,
            text: s.text,
            proposedMeaning: s.proposedMeaning,
            proposedExample: s.proposedExample,
            matches: s.matches,
          }}
        />
      ))}
    </ul>
  );
}
