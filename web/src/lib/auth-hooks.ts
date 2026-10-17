import { APIError, createAuthMiddleware } from "better-auth/api";
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
  }
});

/** Database hook: stamp the age confirmation for email sign-ups (Google confirms in onboarding). */
export function stampAgeConfirmation<T extends Record<string, unknown>>(
  user: T,
  path: string | undefined,
) {
  return path === "/sign-up/email" ? { ...user, ageConfirmedAt: new Date() } : user;
}
