"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Password-reset request as a server action so it works before hydration (progressive
 * enhancement). Always reports success so it can't reveal which emails have accounts.
 */
export async function requestPasswordReset(_prev: { sent: boolean } | null, form: FormData) {
  try {
    await rateLimit("password-reset", 5);
  } catch (err) {
    if (err instanceof AppError) return { sent: true }; // same response either way
    throw err;
  }
  const email = z.email().safeParse(
    String(form.get("email") ?? "")
      .trim()
      .toLowerCase(),
  );
  if (email.success) {
    await auth()
      .api.requestPasswordReset({ body: { email: email.data, redirectTo: "/reset-password" } })
      .catch(() => undefined);
  }
  return { sent: true };
}
