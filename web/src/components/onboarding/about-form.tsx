"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { browserTimeZone } from "@/lib/auth-client";
import { hourLabel, LANGUAGES } from "@/lib/languages";
import { updateProfile } from "@/server/actions/profile";

const selectCls = "bg-card h-12 w-full rounded-xl border px-3";

/** Figma 2:214 — mother tongue and daily reminder (learning goal is out of scope for v1). */
export function AboutForm({
  motherTongue,
  reminderHour,
}: {
  motherTongue: string | null;
  reminderHour: number;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setPending(true);
    const r = await updateProfile({
      motherTongue: (f.get("motherTongue") as string) || null,
      reminderHour: Number(f.get("reminderHour")),
      remindersEnabled: f.get("reminders") === "on",
      timeZone: browserTimeZone(),
    });
    setPending(false);
    if (!r.ok) return toast.error(r.error.message);
    router.push("/today");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-md">
      <p className="text-eyebrow text-center text-xs font-bold tracking-[1.7px] uppercase">
        One last thing
      </p>
      <h1 className="mt-2 text-center text-[clamp(2rem,6vw,2.75rem)] leading-tight">
        Tell us a little about you.
      </h1>
      <div className="mt-8 grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="motherTongue" className="text-xs font-bold">
            Mother tongue
          </Label>
          <select
            id="motherTongue"
            name="motherTongue"
            defaultValue={motherTongue ?? ""}
            className={selectCls}
          >
            <option value="">Choose a language</option>
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reminderHour" className="text-xs font-bold">
            Daily reminder
          </Label>
          <select
            id="reminderHour"
            name="reminderHour"
            defaultValue={reminderHour}
            className={selectCls}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {hourLabel(h)}
              </option>
            ))}
          </select>
          <label className="mt-1 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="reminders"
              defaultChecked
              className="size-4 accent-[#1dd6a4]"
            />{" "}
            Email me a reminder if I haven&apos;t practiced
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl font-bold disabled:opacity-50"
        >
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Build my learning plan <ArrowRight aria-hidden className="size-4" />
        </button>
        <Link href="/onboarding/level" className="text-center text-sm">
          Back to English level
        </Link>
      </div>
    </form>
  );
}
