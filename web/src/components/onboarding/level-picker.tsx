"use client";

import { ArrowRight, Check, Loader2, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { cefrLevels } from "@/db/schema/enums";
import { LEVEL_DESCRIPTIONS, LEVEL_LABELS } from "@/lib/levels";
import { cn } from "@/lib/utils";
import { confirmAgeAction, setLevel } from "@/server/actions/profile";

const BANDS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
] as const;

/** Figma 2:98 — choose a CEFR level (or a simple band, FR-003). */
export function LevelPicker({
  current,
  needsAge,
  next,
}: {
  current: string | null;
  needsAge: boolean;
  next: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<string>(current ?? "");
  const [age, setAge] = useState(!needsAge);
  const [pending, setPending] = useState(false);

  async function onContinue() {
    setPending(true);
    if (needsAge) {
      const r = await confirmAgeAction(age);
      if (!r.ok) {
        setPending(false);
        return toast.error(r.error.message);
      }
    }
    const r = await setLevel(choice);
    setPending(false);
    if (!r.ok) return toast.error(r.error.message);
    router.push(next);
    router.refresh();
  }

  return (
    <div className="text-center">
      <span className="bg-nav-active mx-auto grid size-11 place-items-center rounded-xl">
        <TrendingUp aria-hidden className="size-5" />
      </span>
      <p className="text-eyebrow mt-4 text-xs font-bold tracking-[1.7px] uppercase">
        Let&apos;s personalize your path
      </p>
      <h1 className="mt-2 text-[clamp(2rem,6vw,2.75rem)] leading-tight">
        Where are you <em className="text-brand-link font-bold">with your English?</em>
      </h1>
      <p className="text-muted-foreground mt-3">
        We&apos;ll choose daily chunks that stretch you just enough.
      </p>

      <fieldset className="mx-auto mt-8 max-w-[544px] text-left">
        <legend className="sr-only">Your English level</legend>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {cefrLevels.map((lvl) => {
            const selected = choice === lvl;
            return (
              <label
                key={lvl}
                className={cn(
                  "bg-card flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                  selected && "border-[#1dd6a4] bg-streak",
                )}
              >
                <input
                  type="radio"
                  name="level"
                  value={lvl}
                  checked={selected}
                  onChange={() => setChoice(lvl)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "grid size-9 shrink-0 place-items-center rounded-lg font-bold",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  {lvl}
                </span>
                <span className="flex-1">
                  <span className="block font-bold">{LEVEL_LABELS[lvl]}</span>
                  <span className="text-muted-foreground block text-xs">
                    {LEVEL_DESCRIPTIONS[lvl]}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-5 place-items-center rounded-full border",
                    selected && "bg-[#1dd6a4] border-[#1dd6a4] text-white",
                  )}
                >
                  {selected ? <Check className="size-3" /> : null}
                </span>
              </label>
            );
          })}
        </div>
        <div className="mt-5 text-center">
          <p className="text-muted-foreground text-sm">Not sure? Pick the closest:</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            {BANDS.map((b) => (
              <label
                key={b.value}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-2 text-sm font-bold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                  choice === b.value && "bg-nav-active text-nav-active-foreground",
                )}
              >
                <input
                  type="radio"
                  name="level"
                  value={b.value}
                  checked={choice === b.value}
                  onChange={() => setChoice(b.value)}
                  className="sr-only"
                />
                {b.label}
              </label>
            ))}
          </div>
        </div>
      </fieldset>

      {needsAge ? (
        <label className="bg-surface-subtle mx-auto mt-6 flex max-w-[544px] items-start gap-3 rounded-xl p-3 text-left text-sm">
          <Checkbox checked={age} onCheckedChange={(v) => setAge(v === true)} className="mt-0.5" />
          <span>I am 16 or older</span>
        </label>
      ) : null}

      <button
        type="button"
        onClick={onContinue}
        disabled={!choice || !age || pending}
        className="bg-primary text-primary-foreground mt-7 inline-flex min-h-12 items-center gap-2.5 rounded-xl px-10 font-bold disabled:opacity-50"
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Continue <ArrowRight aria-hidden className="size-4" />
      </button>
    </div>
  );
}
