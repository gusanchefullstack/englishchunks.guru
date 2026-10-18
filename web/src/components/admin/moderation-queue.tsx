"use client";

import { Check, Loader2, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { TYPE_LABELS } from "@/components/session/types";
import { adminApproveChunk, adminRetireChunk } from "@/server/actions/admin";

export type ModerationItem = {
  id: string;
  text: string;
  level: string;
  type: string;
  registers: string[];
  meaning: string;
  examples: { text: string; register: string }[];
  issues: string[];
  suggestedLevel: string | null;
};
type Tab = "pending" | "accepted" | "rejected";

/** What the auditor disagreed about, as a short badge (Figma 14:2 "Automated validation"). */
function badgeFor(item: ModerationItem) {
  if (item.suggestedLevel && item.suggestedLevel !== item.level)
    return `Auditor suggests ${item.suggestedLevel}`;
  if (item.issues.some((i) => /example/i.test(i))) return "Example issue";
  if (item.issues.some((i) => /meaning/i.test(i))) return "Meaning issue";
  return "Needs a look";
}

/**
 * Chunk moderation queue (FR-053): decide in place. A decided card leaves the list and focus
 * moves to the next one, so the reviewer never loses their place.
 */
export function ModerationQueue({ items, tab }: { items: ModerationItem[]; tab: Tab }) {
  const router = useRouter();
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const headings = useRef(new Map<string, HTMLHeadingElement>());
  const visible = items.filter((i) => !removed.has(i.id));

  async function decide(item: ModerationItem, kind: "accept" | "deny" | "restore") {
    setBusy(item.id);
    const r =
      kind === "accept"
        ? await adminApproveChunk(item.id)
        : await adminRetireChunk(item.id, kind === "deny");
    setBusy(null);
    if (!r.ok) return toast.error(r.error.message);
    const index = visible.findIndex((i) => i.id === item.id);
    const next = visible[index + 1] ?? visible[index - 1];
    setRemoved((prev) => new Set(prev).add(item.id));
    const verb = kind === "accept" ? "Accepted" : kind === "deny" ? "Denied" : "Restored";
    setAnnouncement(`${verb} “${item.text}”. ${visible.length - 1} left in this list.`);
    if (next) requestAnimationFrame(() => headings.current.get(next.id)?.focus());
    router.refresh(); // counts, stats and the nav badge
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {visible.length === 0 ? (
        <p className="bg-card rounded-b-xl border border-t-0 p-8 text-center text-sm">
          {tab === "pending" ? "All caught up — nothing waiting for review." : "Nothing here."}
        </p>
      ) : (
        <ul aria-label="Chunks to review" className="rounded-b-xl border border-t-0">
          {visible.map((item) => (
            <li
              key={item.id}
              className="bg-card grid gap-5 border-b p-5 last:rounded-b-xl last:border-b-0 md:grid-cols-[1fr_150px]"
            >
              <article aria-labelledby={`chunk-${item.id}`} className="flex gap-3">
                <span
                  aria-hidden
                  className="bg-sky grid size-10 shrink-0 place-items-center rounded-full text-xs font-black"
                >
                  {item.level}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-muted-foreground text-[11px] font-extrabold tracking-[0.8px] uppercase">
                    Level {item.level} · {TYPE_LABELS[item.type] ?? item.type} ·{" "}
                    {item.registers.join(", ")}
                  </p>
                  <h2
                    id={`chunk-${item.id}`}
                    tabIndex={-1}
                    ref={(el) => {
                      if (el) headings.current.set(item.id, el);
                      else headings.current.delete(item.id);
                    }}
                    className="mt-1 text-[22px] leading-snug outline-offset-4"
                  >
                    “{item.text}”
                  </h2>
                  <p className="text-muted-foreground mt-1 text-sm">{item.meaning}</p>
                  <ol className="mt-3 grid gap-1 text-sm">
                    {item.examples.map((e, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-muted-foreground w-24 shrink-0 text-xs font-bold capitalize">
                          {e.register}
                        </span>
                        <span>{e.text}</span>
                      </li>
                    ))}
                  </ol>
                  {item.issues.length ? (
                    <div className="bg-surface-subtle mt-4 flex items-start gap-3 rounded-lg p-3">
                      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold">Automated validation</p>
                        <ul className="text-muted-foreground mt-0.5 text-xs">
                          {item.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      </div>
                      <span className="bg-nav-active text-nav-active-foreground shrink-0 rounded-md px-2 py-1 text-xs font-semibold italic">
                        {badgeFor(item)}
                      </span>
                    </div>
                  ) : null}
                </div>
              </article>
              <div className="flex flex-col justify-center gap-2">
                {tab === "pending" ? (
                  <>
                    <button
                      type="button"
                      onClick={() => decide(item, "accept")}
                      aria-disabled={busy !== null}
                      aria-label={`Accept “${item.text}”`}
                      className="bg-primary text-primary-foreground inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-extrabold aria-disabled:opacity-60"
                    >
                      {busy === item.id ? (
                        <Loader2 aria-hidden className="size-4 animate-spin" />
                      ) : (
                        <Check aria-hidden className="size-4" />
                      )}
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => decide(item, "deny")}
                      aria-disabled={busy !== null}
                      aria-label={`Deny “${item.text}”`}
                      className="bg-danger-soft border-danger-soft-border text-danger-soft-foreground inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-extrabold aria-disabled:opacity-60"
                    >
                      <X aria-hidden className="size-4" />
                      Deny
                    </button>
                  </>
                ) : tab === "rejected" ? (
                  <button
                    type="button"
                    onClick={() => decide(item, "restore")}
                    aria-disabled={busy !== null}
                    aria-label={`Restore “${item.text}” to the review queue`}
                    className="bg-card inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border px-3 text-sm font-extrabold"
                  >
                    <RotateCcw aria-hidden className="size-4" />
                    Restore
                  </button>
                ) : null}
                <Link
                  href={`/admin/chunks/${item.id}?from=review`}
                  aria-label={`Edit “${item.text}”`}
                  className="text-brand-link inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-extrabold"
                >
                  <Pencil aria-hidden className="size-3.5" />
                  Edit
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
