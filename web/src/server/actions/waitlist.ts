"use server";

import { z } from "zod";
import { joinWaitlist } from "@/lib/domain/signup-gate";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function joinWaitlistAction(
  _prev: { done: boolean; error?: string } | null,
  form: FormData,
) {
  const email = z.email().safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (!email.success) return { done: false, error: "Please enter a valid email." };
  try {
    await rateLimit("waitlist", 5);
  } catch (err) {
    if (err instanceof AppError) return { done: false, error: err.message };
    throw err;
  }
  await joinWaitlist(email.data);
  return { done: true };
}
