"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { startTodayAndGo } from "@/server/actions/session";
import { primaryBtn } from "./ui";

export function StartTodayButton() {
  const [state, action, pending] = useActionState(
    async () => (await startTodayAndGo()) ?? null,
    null,
  );
  return (
    <form action={action} className="flex flex-col items-center gap-2">
      <button type="submit" className={primaryBtn} disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Start today&apos;s chunk <ArrowRight aria-hidden className="size-4" />
      </button>
      <p role="status" aria-live="polite" className="text-destructive text-sm">
        {state?.error}
      </p>
    </form>
  );
}
