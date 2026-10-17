import { APIError, createAuthMiddleware } from "better-auth/api";
import { mayCreateAccount, markInviteUsed } from "@/lib/domain/signup-gate";
import { isValidTimeZone } from "@/lib/domain/time";

/**
 * Runs before Better Auth endpoints.
 * - Email sign-up requires `ageConfirmed: true` (FR-007, 16+, self-declared).
 * Sign-up gates added by later stories (account cap, billing trial) extend this function.
 */
export const beforeAuth = createAuthMiddleware(async (ctx) => {
  if (ctx.path === "/sign-up/email") {
    const body = (ctx.body ?? {}) as { ageConfirmed?: unknown; timeZone?: unknown };
    if (body.ageConfirmed !== true) {
      throw new APIError("BAD_REQUEST", {
        code: "AGE_CONFIRMATION_REQUIRED",
        message: "Please confirm you are 16 or older.",
      });
    }
    if (typeof body.timeZone === "string" && !isValidTimeZone(body.timeZone)) {
      (ctx.body as { timeZone?: string }).timeZone = "UTC";
    }
    // FR-055: checked here (not only in the DB hook) because Better Auth hides user-creation
    // failures on email sign-up behind a synthetic success to prevent account enumeration.
    const { email, inviteToken } = ctx.body as { email?: string; inviteToken?: string };
    if (!(await mayCreateAccount(String(email ?? ""), inviteToken))) throw signupClosed();
  }
});

/** Database hook: stamp the age confirmation for email sign-ups (Google confirms in onboarding). */
export function stampAgeConfirmation<T extends Record<string, unknown>>(
  user: T,
  path: string | undefined,
) {
  return path === "/sign-up/email" ? { ...user, ageConfirmedAt: new Date() } : user;
}

function signupClosed() {
  return new APIError("FORBIDDEN", {
    code: "SIGNUP_CLOSED",
    message: "We're full for now — join the waitlist and we'll invite you soon.",
  });
}

/**
 * Database hook (backstop, e.g. Google sign-ups) for every new account (email or Google): enforce the account cap (FR-055).
 * Admin-created accounts are exempt. The invite token (if any) comes from the sign-up body.
 */
export async function gateAccountCreation(
  u: { email: string },
  ctx: { path?: string; body?: unknown } | null | undefined,
) {
  if (ctx?.path === "/admin/create-user") return;
  const token = (ctx?.body as { inviteToken?: string } | undefined)?.inviteToken ?? null;
  if (!(await mayCreateAccount(u.email, token))) throw signupClosed();
}

export async function afterAccountCreated(
  u: { email: string },
  ctx: { body?: unknown } | null | undefined,
) {
  if ((ctx?.body as { inviteToken?: string } | undefined)?.inviteToken)
    await markInviteUsed(u.email);
}
