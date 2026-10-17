"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";
import { joinWaitlistAction } from "@/server/actions/waitlist";
import { Field, submitBtn } from "./fields";

export function WaitlistForm({ email }: { email?: string }) {
  const [state, action, pending] = useActionState(joinWaitlistAction, null);
  if (state?.done) {
    return (
      <p role="status" className="bg-tag-level text-tag-level-foreground mt-6 rounded-xl p-4">
        You&apos;re on the list! We&apos;ll email you an invitation as soon as a spot opens.
      </p>
    );
  }
  return (
    <form action={action} className="mt-7 grid gap-4">
      <Field
        label="Email address"
        id="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={email}
      />
      <p role="alert" className="text-destructive text-sm">
        {state?.error}
      </p>
      <button type="submit" className={submitBtn} disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
        Join the waitlist
      </button>
    </form>
  );
}
