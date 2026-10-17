"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cefrLevels, chunkTypes } from "@/db/schema/enums";
import { TYPE_LABELS } from "@/components/session/types";
import { adminDecideSubmission } from "@/server/actions/submissions";

type Sub = {
  id: string;
  text: string;
  proposedMeaning: string | null;
  proposedExample: string | null;
  matches: { id: string; text: string }[];
};
const field = "bg-card h-10 w-full rounded-lg border px-3 text-sm";

export function ReviewCard({ sub }: { sub: Sub }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function accept(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await adminDecideSubmission({
      submissionId: sub.id,
      decision: "accept",
      chunk: {
        text: f.get("text"),
        type: f.get("type"),
        level: f.get("level"),
        registers: f.getAll("registers"),
        meaning: f.get("meaning"),
        usageNote: f.get("usageNote"),
        examples: [1, 2, 3].map((i) => ({ text: f.get(`ex${i}`), register: f.get(`exr${i}`) })),
      },
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Accepted and published");
    router.refresh();
  }

  async function reject() {
    const reason =
      (document.getElementById(`reason-${sub.id}`) as HTMLInputElement | null)?.value ?? "";
    setBusy(true);
    const r = await adminDecideSubmission({ submissionId: sub.id, decision: "reject", reason });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Rejected");
    router.refresh();
  }

  const id = (n: string) => `${n}-${sub.id}`;
  return (
    <li className="bg-card rounded-2xl border p-5">
      <h2 className="text-xl">“{sub.text}”</h2>
      {sub.matches.length ? (
        <p className="text-muted-foreground mt-1 text-sm">
          Similar existing: {sub.matches.map((m) => m.text).join(", ")}
        </p>
      ) : null}
      <form
        onSubmit={accept}
        className="mt-4 grid gap-3 md:grid-cols-2"
        aria-label={`Accept “${sub.text}”`}
      >
        <label className="grid gap-1 text-xs font-bold">
          Text
          <input name="text" defaultValue={sub.text} required maxLength={80} className={field} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs font-bold">
            Type
            <select name="type" required className={field} defaultValue="idiom">
              {chunkTypes.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-bold">
            Level
            <select name="level" required className={field} defaultValue="B1">
              {cefrLevels.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
        </div>
        <label className="grid gap-1 text-xs font-bold md:col-span-2">
          Meaning
          <input
            name="meaning"
            defaultValue={sub.proposedMeaning ?? ""}
            required
            maxLength={300}
            className={field}
          />
        </label>
        <label className="grid gap-1 text-xs font-bold md:col-span-2">
          When to use it
          <input name="usageNote" required maxLength={400} className={field} />
        </label>
        <fieldset className="flex gap-4 text-sm md:col-span-2">
          <legend className="text-xs font-bold">Registers</legend>
          {(["casual", "academic", "professional"] as const).map((r) => (
            <label key={r} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="registers"
                value={r}
                defaultChecked={r === "casual"}
                className="size-4"
              />
              {r}
            </label>
          ))}
        </fieldset>
        {[1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-[1fr_130px] gap-2 md:col-span-2">
            <label className="grid gap-1 text-xs font-bold">
              Example {i}
              <input
                name={`ex${i}`}
                required
                maxLength={200}
                defaultValue={i === 1 ? (sub.proposedExample ?? "") : ""}
                className={field}
              />
            </label>
            <label className="grid gap-1 text-xs font-bold">
              Register
              <select
                name={`exr${i}`}
                className={field}
                defaultValue={i === 2 ? "professional" : "casual"}
              >
                <option value="casual">casual</option>
                <option value="professional">professional</option>
              </select>
            </label>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-3 md:col-span-2">
          <button
            type="submit"
            disabled={busy}
            className="bg-primary text-primary-foreground min-h-11 rounded-xl px-4 font-bold"
          >
            Accept and publish
          </button>
          <label className="grid flex-1 gap-1 text-xs font-bold">
            Reject reason (optional)
            <input id={id("reason")} maxLength={300} className={field} />
          </label>
          <button
            type="button"
            onClick={reject}
            disabled={busy}
            className="text-destructive border-destructive min-h-11 rounded-xl border px-4 font-bold"
          >
            Reject
          </button>
        </div>
      </form>
    </li>
  );
}
