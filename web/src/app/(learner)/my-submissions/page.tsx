import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { mySubmissions } from "@/lib/domain/submissions";
import { learnerOrRedirect } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "My suggestions" };

const STATUS = {
  pending: { label: "Waiting for review", cls: "bg-tag-type text-tag-type-foreground" },
  merged: {
    label: "Already suggested — added your vote",
    cls: "bg-tag-type text-tag-type-foreground",
  },
  accepted: { label: "Accepted · +20 points", cls: "bg-tag-level text-tag-level-foreground" },
  rejected: { label: "Not added", cls: "bg-muted text-foreground" },
} as const;

export default function MySubmissionsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Grow the library</p>
      <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">My suggestions</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-64 animate-pulse rounded-2xl" />}
      >
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  const u = await learnerOrRedirect();
  const rows = await mySubmissions(u.id);
  if (!rows.length) {
    return (
      <p className="bg-card mt-6 rounded-2xl border p-6">
        No suggestions yet. <Link href="/submit-chunk">Suggest your first chunk</Link>
      </p>
    );
  }
  return (
    <ul className="mt-6 grid gap-3">
      {rows.map((r) => (
        <li key={r.id} className="bg-card rounded-2xl border p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-lg">{r.text}</p>
            <span className={cn("rounded-full px-3 py-1 text-xs font-bold", STATUS[r.status].cls)}>
              {STATUS[r.status].label}
            </span>
          </div>
          {r.decisionReason ? (
            <p className="text-muted-foreground mt-2 text-sm">Reviewer note: {r.decisionReason}</p>
          ) : null}
          {r.resultingChunkId ? (
            <Link href={`/library/${r.resultingChunkId}`} className="mt-2 inline-block text-sm">
              Open in the library
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
