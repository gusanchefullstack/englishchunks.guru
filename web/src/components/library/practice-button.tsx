"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState } from "react";
import { practiceChunkAndGo } from "@/server/actions/session";

export function PracticeChunkButton({
  chunkId,
  remaining,
}: {
  chunkId: string;
  remaining: number;
}) {
  const [state, action, pending] = useActionState(
    async () => (await practiceChunkAndGo(chunkId)) ?? null,
    null,
  );
  return (
    <form action={action} className="flex flex-col items-start gap-2">
      <button
        type="submit"
        disabled={pending || remaining === 0}
        className="bg-primary text-primary-foreground inline-flex min-h-12 items-center gap-2.5 rounded-xl px-5 font-bold disabled:opacity-50"
      >
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Practice this chunk <ArrowRight aria-hidden className="size-4" />
      </button>
      <p className="text-muted-foreground text-sm">
        {remaining > 0
          ? `${remaining} practice${remaining === 1 ? "" : "s"} left today.`
          : "You've used today's practices. More unlock tomorrow — Standard and Premium include more each day."}
      </p>
      <p role="alert" className="text-destructive text-sm">
        {state?.error}
      </p>
    </form>
  );
}
