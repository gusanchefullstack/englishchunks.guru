"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TYPE_LABELS } from "@/components/session/types";
import { cefrLevels, chunkTypes } from "@/db/schema/enums";
import { adminRetireChunk, adminUpsertChunk } from "@/server/actions/admin";

type Initial = {
  id: string | null;
  text: string;
  type: string;
  level: string;
  registers: string[];
  meaning: string;
  usageNote: string;
  status: string;
  examples: { text: string; register: string }[];
};
const field = "bg-card h-10 w-full rounded-lg border px-3 text-sm";

export function ChunkForm({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const r = await adminUpsertChunk(initial.id, {
      text: f.get("text"),
      type: f.get("type"),
      level: f.get("level"),
      registers: f.getAll("registers"),
      meaning: f.get("meaning"),
      usageNote: f.get("usageNote"),
      examples: [1, 2, 3].map((i) => ({ text: f.get(`ex${i}`), register: f.get(`exr${i}`) })),
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("Saved — IPA recomputed");
    router.push(`/admin/chunks/${r.data.id}`);
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="grid gap-3 md:grid-cols-2">
      <label className="grid gap-1 text-xs font-bold">
        Chunk
        <input name="text" defaultValue={initial.text} required maxLength={80} className={field} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1 text-xs font-bold">
          Type
          <select name="type" defaultValue={initial.type} className={field}>
            {chunkTypes.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs font-bold">
          Level
          <select name="level" defaultValue={initial.level} className={field}>
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
          defaultValue={initial.meaning}
          required
          maxLength={300}
          className={field}
        />
      </label>
      <label className="grid gap-1 text-xs font-bold md:col-span-2">
        When to use it
        <input
          name="usageNote"
          defaultValue={initial.usageNote}
          required
          maxLength={400}
          className={field}
        />
      </label>
      <fieldset className="flex gap-4 text-sm md:col-span-2">
        <legend className="text-xs font-bold">Registers</legend>
        {(["casual", "academic", "professional"] as const).map((r) => (
          <label key={r} className="flex items-center gap-1.5">
            <input
              type="checkbox"
              name="registers"
              value={r}
              defaultChecked={initial.registers.includes(r)}
              className="size-4"
            />
            {r}
          </label>
        ))}
      </fieldset>
      {[0, 1, 2].map((i) => (
        <div key={i} className="grid grid-cols-[1fr_140px] gap-2 md:col-span-2">
          <label className="grid gap-1 text-xs font-bold">
            Example {i + 1}
            <input
              name={`ex${i + 1}`}
              defaultValue={initial.examples[i]?.text ?? ""}
              required
              maxLength={200}
              className={field}
            />
          </label>
          <label className="grid gap-1 text-xs font-bold">
            Register
            <select
              name={`exr${i + 1}`}
              defaultValue={initial.examples[i]?.register ?? "casual"}
              className={field}
            >
              <option value="casual">casual</option>
              <option value="professional">professional</option>
            </select>
          </label>
        </div>
      ))}
      <div className="flex flex-wrap gap-3 md:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold"
        >
          {initial.id ? "Save changes" : "Create chunk"}
        </button>
        {initial.id ? (
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              const r = await adminRetireChunk(initial.id!, initial.status !== "retired");
              if (!r.ok) return toast.error(r.error.message);
              toast.success(initial.status === "retired" ? "Restored" : "Retired");
              router.refresh();
            }}
            className="h-10 rounded-lg border px-4 text-sm font-bold"
          >
            {initial.status === "retired" ? "Restore" : "Retire"}
          </button>
        ) : null}
      </div>
    </form>
  );
}
