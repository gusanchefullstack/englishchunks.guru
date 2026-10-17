"use server";

import { z } from "zod";
import { auth } from "@/lib/auth";

/**
 * Password-reset request as a server action so it works before hydration (progressive
 * enhancement). Always reports success so it can't reveal which emails have accounts.
 */
export async function requestPasswordReset(_prev: { sent: boolean } | null, form: FormData) {
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
