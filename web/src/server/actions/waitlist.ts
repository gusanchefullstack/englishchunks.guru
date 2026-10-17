"use server";

import { z } from "zod";
import { joinWaitlist } from "@/lib/domain/signup-gate";

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
  await joinWaitlist(email.data);
  return { done: true };
}
