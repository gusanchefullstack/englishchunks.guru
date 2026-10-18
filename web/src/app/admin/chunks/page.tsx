import { BookOpen, CalendarCheck, Search, SquareCheckBig } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { ModerationQueue, type ModerationItem } from "@/components/admin/moderation-queue";
import { TYPE_LABELS } from "@/components/session/types";
import { adminOrNotFound } from "@/lib/admin-guard";
import {
  listAdminChunks,
  listModeration,
  moderationStats,
  pendingModerationCount,
} from "@/lib/domain/admin-chunks";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chunk moderation · Admin" };
type Search = { tab?: string; q?: string };
const TABS = [
  { v: "pending", label: "Pending" },
  { v: "accepted", label: "Accepted" },
  { v: "rejected", label: "Rejected" },
  { v: "all", label: "All chunks" },
] as const;

/** Figma 14:2 — chunk moderation: review what the auditor flagged without leaving the queue. */
export default function ChunksPage({ searchParams }: PageProps<"/admin/chunks">) {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-[640px] animate-pulse rounded-2xl" />}
    >
      <Moderation searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function Moderation({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await adminOrNotFound();
  const tab = TABS.some((t) => t.v === sp.tab) ? (sp.tab as (typeof TABS)[number]["v"]) : "pending";
  const [pending, stats] = await Promise.all([pendingModerationCount(), moderationStats()]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">
            Content operations
          </p>
          <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Chunk moderation</h1>
          <p className="text-muted-foreground mt-2">
            Review the chunks the auditor flagged before learners see them.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/chunks/new"
            className="bg-card inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-bold"
          >
            New chunk
          </Link>
          <p className="bg-card flex items-center gap-2 rounded-xl border px-4 py-2">
            <span className="text-tag-type-foreground text-2xl font-bold">{pending}</span>
            <span className="text-muted-foreground w-16 text-xs leading-tight">
              Waiting for review
            </span>
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat icon={<BookOpen aria-hidden className="size-5" />} label="Library size">
          {stats.librarySize.toLocaleString("en-US")}
        </Stat>
        <Stat icon={<CalendarCheck aria-hidden className="size-5" />} label="Reviewed this week">
          {stats.reviewedThisWeek}
        </Stat>
        <Stat icon={<SquareCheckBig aria-hidden className="size-5" />} label="Acceptance rate">
          {stats.acceptanceRate === null ? "—" : `${stats.acceptanceRate}%`}
        </Stat>
      </div>

      <div className="bg-card mt-5 flex flex-wrap items-center justify-between gap-3 rounded-t-xl border p-3">
        <nav aria-label="Moderation views" className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <Link
              key={t.v}
              href={`/admin/chunks?tab=${t.v}`}
              aria-current={tab === t.v ? "page" : undefined}
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-extrabold",
                tab === t.v ? "bg-nav-active text-nav-active-foreground" : "text-muted-foreground",
              )}
            >
              {t.label}
              {t.v === "pending" ? ` ${pending}` : ""}
            </Link>
          ))}
        </nav>
        <form method="get" role="search" className="w-full sm:w-64">
          <input type="hidden" name="tab" value={tab} />
          <label className="bg-card flex h-10 items-center gap-2 rounded-lg border px-3">
            <Search aria-hidden className="text-muted-foreground size-4" />
            <span className="sr-only">Search chunks</span>
            <input
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="Search chunks…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </form>
      </div>

      {tab === "all" ? <AllChunks q={sp.q} /> : <Queue tab={tab} q={sp.q} />}
    </>
  );
}

function Stat({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="bg-card flex items-center gap-3 rounded-xl border p-4">
      <span className="bg-tag-type text-tag-type-foreground grid size-10 place-items-center rounded-lg">
        {icon}
      </span>
      <div>
        <p className="text-muted-foreground text-xs tracking-[1px] uppercase">{label}</p>
        <p className="text-xl font-bold">{children}</p>
      </div>
    </div>
  );
}

async function Queue({ tab, q }: { tab: "pending" | "accepted" | "rejected"; q?: string }) {
  const { rows } = await listModeration({ tab, q });
  const items: ModerationItem[] = rows.map((r) => {
    const notes = (r.auditNotes ?? {}) as { issues?: unknown; suggestedLevel?: unknown };
    return {
      id: r.id,
      text: r.text,
      level: r.level,
      type: r.type,
      registers: r.registers,
      meaning: r.meaning,
      examples: r.examples.map((e) => ({ text: e.text, register: e.register })),
      issues: Array.isArray(notes.issues) ? notes.issues.map(String) : [],
      suggestedLevel: typeof notes.suggestedLevel === "string" ? notes.suggestedLevel : null,
    };
  });
  // key: a new list (tab/search) starts with a fresh "removed" set.
  return <ModerationQueue key={`${tab}-${q ?? ""}`} items={items} tab={tab} />;
}

async function AllChunks({ q }: { q?: string }) {
  const { rows } = await listAdminChunks({ q });
  return (
    <ul aria-label="All chunks" className="rounded-b-xl border border-t-0">
      {rows.map((c) => (
        <li key={c.id} className="bg-card border-b px-4 py-3 last:rounded-b-xl last:border-b-0">
          <Link href={`/admin/chunks/${c.id}`} className="font-bold">
            {c.text}
          </Link>
          <p className="text-muted-foreground text-xs">
            {c.level} · {TYPE_LABELS[c.type]} · {c.source} · audit {c.auditStatus}
          </p>
        </li>
      ))}
      {!rows.length ? <li className="bg-card rounded-b-xl p-4 text-sm">Nothing here.</li> : null}
    </ul>
  );
}
