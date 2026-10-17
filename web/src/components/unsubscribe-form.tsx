"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { confirmUnsubscribe } from "@/server/actions/unsubscribe";

export function UnsubscribeForm() {
  const token = useSearchParams().get("token") ?? "";
  const [state, action, pending] = useActionState(confirmUnsubscribe, null);
  if (state?.done) {
    return (
      <p role="status" className="bg-tag-level text-tag-level-foreground mt-6 rounded-xl p-4">
        Daily reminders are off. You can turn them back on in your profile anytime.
      </p>
    );
  }
  return (
    <form action={action} className="mt-6 grid gap-3">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        disabled={pending}
        className="bg-primary text-primary-foreground min-h-12 rounded-xl px-5 font-bold disabled:opacity-50"
      >
        Turn off reminders
      </button>
      <p role="alert" className="text-destructive text-sm">
        {state?.error}
      </p>
    </form>
  );
}
