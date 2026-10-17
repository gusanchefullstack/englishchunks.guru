"use server";

import { unsubscribeReminders } from "@/lib/domain/unsubscribe";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function confirmUnsubscribe(
  _prev: { done: boolean; error?: string } | null,
  form: FormData,
) {
  try {
    await rateLimit("unsubscribe", 20);
  } catch (err) {
    if (err instanceof AppError) return { done: false, error: err.message };
    throw err;
  }
  const ok = await unsubscribeReminders(String(form.get("token") ?? ""));
  return ok
    ? { done: true }
    : { done: false, error: "This link isn't valid. You can turn reminders off in your profile." };
}
