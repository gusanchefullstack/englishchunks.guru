import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { TYPE_LABELS } from "@/components/session/types";
import { adminOrNotFound } from "@/lib/admin-guard";
import { listAdminChunks } from "@/lib/domain/admin-chunks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chunks · Admin" };
type Search = { q?: string; view?: string };

export default function ChunksPage({ searchParams }: PageProps<"/admin/chunks">) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-[34px] leading-tight tracking-[-1px]">Chunks</h1>
        <Link
          href="/admin/chunks/new"
          className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-sm font-bold"
        >
          New chunk
        </Link>
      </div>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-96 animate-pulse rounded-2xl" />}
      >
        <List searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function List({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await adminOrNotFound();
  const { filter, rows } = await listAdminChunks(sp);
  const view = filter.view ?? "active";
  const tabs = [
    { v: "active", label: "Active" },
    { v: "audit_failed", label: "Audit failed (review)" },
    { v: "retired", label: "Retired" },
  ];
  return (
    <>
      <nav aria-label="Chunk views" className="mt-6 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.v}
            href={`/admin/chunks?view=${t.v}`}
            aria-current={view === t.v ? "page" : undefined}
            className={cn(
              "rounded-lg border px-3 py-1.5 text-sm font-bold",
              view === t.v && "bg-nav-active text-nav-active-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <form method="get" role="search" className="mt-4 flex gap-2">
        <input type="hidden" name="view" value={view} />
        <label>
          <span className="sr-only">Search chunks</span>
          <input
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Search"
            className="bg-card h-10 w-64 rounded-lg border px-3 text-sm"
          />
        </label>
        <button type="submit" className="h-10 rounded-lg border px-4 text-sm font-bold">
          Search
        </button>
      </form>
      <ul className="mt-4 grid gap-2">
        {rows.map((c) => (
          <li
            key={c.id}
            className="bg-card flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3"
          >
            <div>
              <Link href={`/admin/chunks/${c.id}`} className="font-bold">
                {c.text}
              </Link>
              <p className="text-muted-foreground text-xs">
                {c.level} · {TYPE_LABELS[c.type]} · {c.source} · audit {c.auditStatus}
              </p>
            </div>
          </li>
        ))}
        {!rows.length ? (
          <li className="bg-card rounded-xl border p-4 text-sm">Nothing here.</li>
        ) : null}
      </ul>
    </>
  );
}
