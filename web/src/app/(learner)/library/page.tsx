import { ArrowRight, Lightbulb, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Tag } from "@/components/session/ui";
import { TYPE_LABELS } from "@/components/session/types";
import { cefrLevels, chunkTypes } from "@/db/schema/enums";
import { libraryTotal, searchChunks } from "@/lib/domain/library";
import { LEVEL_LABELS } from "@/lib/levels";
import { learnerOrRedirect } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Chunk library" };

type Search = { q?: string; level?: string; type?: string; register?: string; page?: string };

const REGISTER_LABEL = { casual: "Casual", academic: "Academic", professional: "Work" } as const;
const CHIPS = [
  "idiom",
  "collocation",
  "sentence_frame",
  "polyword",
  "verb_pattern",
  "discourse_marker",
  "vague_language",
] as const;
const control = "bg-card h-12 rounded-xl border px-3";

export default function LibraryPage({ searchParams }: PageProps<"/library">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="bg-muted h-[600px] animate-pulse rounded-[20px]" />
      }
    >
      <LibraryContent searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

async function LibraryContent({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await learnerOrRedirect();
  const [result, total] = await Promise.all([searchChunks(sp), libraryTotal()]);
  const { query } = result;
  const href = (patch: Partial<Search>) => {
    const q = new URLSearchParams(
      Object.entries({
        q: query.q,
        level: query.level,
        type: query.type,
        register: query.register,
        ...patch,
      }).filter((e): e is [string, string] => Boolean(e[1])),
    );
    return `/library${q.size ? `?${q}` : ""}`;
  };
  const filtered = Boolean(query.q || query.level || query.type || query.register);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">
            Explore real English
          </p>
          <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Chunk library</h1>
          <p className="text-muted-foreground mt-1">
            Browse useful expressions, matched to your level.
          </p>
        </div>
        <Link
          href="/submit-chunk"
          className="bg-card inline-flex min-h-12 items-center gap-2 rounded-xl border px-5 font-bold"
        >
          <Lightbulb aria-hidden className="size-4" /> Suggest a chunk
        </Link>
      </div>

      <div className="bg-coach text-snow mt-7 flex flex-wrap items-center gap-6 rounded-[20px] p-6">
        <div>
          <p className="text-4xl font-bold">{total.toLocaleString("en-US")}</p>
          <p className="text-mint text-xs font-bold tracking-[1.3px] uppercase">Curated chunks</p>
        </div>
        <p className="text-coach-foreground max-w-md text-sm">
          Curated across A1–C2 for casual, academic, and professional English.
        </p>
        <nav aria-label="Browse by type" className="flex flex-wrap gap-2">
          {CHIPS.map((t) => (
            <Link
              key={t}
              href={href({ type: query.type === t ? undefined : t, page: undefined })}
              aria-current={query.type === t ? "true" : undefined}
              className={cn(
                "rounded-full border border-white/20 px-3 py-1.5 text-sm font-bold",
                query.type === t ? "bg-mint text-ink" : "text-snow",
              )}
            >
              {TYPE_LABELS[t]}
            </Link>
          ))}
        </nav>
      </div>

      <form
        method="get"
        action="/library"
        role="search"
        className="mt-6 grid gap-3 md:grid-cols-[1fr_180px_200px_auto]"
      >
        <label className="relative">
          <span className="sr-only">Search chunks</span>
          <Search
            aria-hidden
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            name="q"
            defaultValue={query.q ?? ""}
            placeholder="Search meanings, phrases, or types…"
            className={cn(control, "w-full pl-9")}
          />
        </label>
        <label>
          <span className="sr-only">Level</span>
          <select name="level" defaultValue={query.level ?? ""} className={cn(control, "w-full")}>
            <option value="">All levels</option>
            {cefrLevels.map((l) => (
              <option key={l} value={l}>
                {l} · {LEVEL_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Chunk type</span>
          <select name="type" defaultValue={query.type ?? ""} className={cn(control, "w-full")}>
            <option value="">All chunk types</option>
            {chunkTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground min-h-12 rounded-xl px-6 font-bold"
        >
          Search
        </button>
      </form>

      <div className="mt-6 flex items-center justify-between">
        <p className="font-bold" role="status">
          {result.total} {filtered ? "matching" : ""} chunk{result.total === 1 ? "" : "s"}
        </p>
        {filtered ? (
          <Link href="/library" className="text-sm">
            Clear filters
          </Link>
        ) : null}
      </div>

      {result.items.length ? (
        <ul className="mt-4 grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
          {result.items.map((c) => (
            <li key={c.id} className="bg-card flex flex-col rounded-2xl border p-5">
              <div className="flex flex-wrap gap-2">
                <Tag tone="level">{c.level}</Tag>
                <Tag>{TYPE_LABELS[c.type]}</Tag>
              </div>
              <h2 className="mt-4 text-xl leading-snug">{c.text}</h2>
              <p className="text-muted-foreground mt-1 flex-1 text-sm">{c.meaning}</p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <span className="text-muted-foreground text-xs">
                  {c.registers.map((r) => REGISTER_LABEL[r]).join(" + ")}
                </span>
                <Link
                  href={`/library/${c.id}`}
                  aria-label={`Open lesson: ${c.text}`}
                  className="inline-flex items-center gap-1 text-sm font-bold"
                >
                  Open lesson <ArrowRight aria-hidden className="size-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-card mt-4 rounded-2xl border p-8 text-center">
          <p className="font-bold">No chunks match yet.</p>
          <p className="text-muted-foreground mt-1 text-sm">
            Try fewer words, or <Link href="/submit-chunk">suggest this chunk</Link> for the
            library.
          </p>
        </div>
      )}

      {result.pages > 1 ? (
        <nav aria-label="Pages" className="mt-6 flex items-center justify-center gap-3">
          {result.page > 1 ? (
            <Link
              href={href({ page: String(result.page - 1) })}
              className="bg-card rounded-xl border px-4 py-2 font-bold"
            >
              Previous
            </Link>
          ) : null}
          <span className="text-muted-foreground text-sm">
            Page {result.page} of {result.pages}
          </span>
          {result.page < result.pages ? (
            <Link
              href={href({ page: String(result.page + 1) })}
              className="bg-card rounded-xl border px-4 py-2 font-bold"
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
