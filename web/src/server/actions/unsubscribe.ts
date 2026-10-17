"use server";

import { unsubscribeReminders } from "@/lib/domain/unsubscribe";

export async function confirmUnsubscribe(
  _prev: { done: boolean; error?: string } | null,
  form: FormData,
) {
  const ok = await unsubscribeReminders(String(form.get("token") ?? ""));
  return ok
    ? { done: true }
    : { done: false, error: "This link isn't valid. You can turn reminders off in your profile." };
}
