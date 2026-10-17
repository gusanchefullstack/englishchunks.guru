"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { checkChunkDuplicate, submitChunk } from "@/server/actions/submissions";

type Match = { id: string; text: string; meaning?: string };
const input = "bg-card h-12 w-full rounded-xl border px-3";

export function SubmitChunkForm() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ for: string; exact: Match | null; similar: Match[] }>({
    for: "",
    exact: null,
    similar: [],
  });
  // Only show suggestions that belong to the current text (derived, not reset in an effect).
  const current = result.for === text.trim() && text.trim().length >= 2;
  const exact = current ? result.exact : null;
  const similar = current ? result.similar : [];
  const [ack, setAck] = useState(false);
  const [pending, setPending] = useState(false);

  // Live duplicate check (debounced) — FR-043.
  useEffect(() => {
    const t = text.trim();
    if (t.length < 2) return;
    const timer = setTimeout(async () => {
      const r = await checkChunkDuplicate(t);
      if (r.ok) setResult({ for: t, exact: r.data.exact, similar: r.data.similar });
    }, 350);
    return () => clearTimeout(timer);
  }, [text]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    const r = await submitChunk({
      text,
      meaning: f.get("meaning"),
      example: f.get("example"),
      acknowledgeSimilar: ack,
    });
    setPending(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success(
      r.data.status === "merged"
        ? "Someone suggested this too — we've added your vote."
        : "Thanks! An admin will review it soon.",
    );
    router.push("/my-submissions");
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5">
      <div className="grid gap-1.5">
        <Label htmlFor="text" className="text-xs font-bold">
          The chunk
        </Label>
        <input
          id="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={80}
          required
          className={input}
          placeholder="e.g. break the ice"
          aria-describedby="dup-status"
        />
      </div>
      <div id="dup-status" role="status" aria-live="polite">
        {exact ? (
          <div className="bg-tag-level text-tag-level-foreground rounded-xl p-4 text-sm">
            <p className="font-bold">This chunk is already in the library.</p>
            <Link href={`/library/${exact.id}`}>Open “{exact.text}”</Link>
          </div>
        ) : similar.length ? (
          <div className="bg-surface-subtle rounded-xl border p-4 text-sm">
            <p className="font-bold">Similar chunks already in the library:</p>
            <ul className="mt-2 grid gap-1">
              {similar.map((s) => (
                <li key={s.id}>
                  <Link href={`/library/${s.id}`}>{s.text}</Link>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                checked={ack}
                onChange={(e) => setAck(e.target.checked)}
                className="size-4 accent-[#1dd6a4]"
              />
              Mine is different — submit it anyway
            </label>
          </div>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="meaning" className="text-xs font-bold">
          What it means (optional)
        </Label>
        <input id="meaning" name="meaning" maxLength={300} className={input} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="example" className="text-xs font-bold">
          An example sentence (optional)
        </Label>
        <input id="example" name="example" maxLength={200} className={input} />
      </div>
      <button
        type="submit"
        disabled={pending || !!exact || text.trim().length < 2 || (similar.length > 0 && !ack)}
        className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 font-bold disabled:opacity-50"
      >
        {pending ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : (
          <Lightbulb aria-hidden className="size-4" />
        )}
        Suggest this chunk
      </button>
    </form>
  );
}
