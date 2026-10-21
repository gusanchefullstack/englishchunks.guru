/** Password and username rules shared by the auth server (lib/auth.ts) and the sign-up form. */
export const PASSWORD_MIN = 8;
/** Better Auth's default maxPasswordLength. */
export const PASSWORD_MAX = 128;
export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

/** The first rule a username breaks, in plain words; "" when it's valid (or still empty). */
export function usernameProblem(value: string): string {
  if (!value) return "";
  const bad = [...new Set(value.replace(/[a-z0-9_]/g, ""))];
  if (bad.includes(" ")) return "No spaces — use _ instead.";
  if (bad.length) return `Not allowed: ${bad.join(" ")} — use only a–z, 0–9 or _.`;
  const missing = USERNAME_MIN - value.length;
  if (missing > 0)
    return `Too short — ${missing} more character${missing === 1 ? "" : "s"} needed.`;
  if (value.length > USERNAME_MAX) return `Too long — ${USERNAME_MAX} characters at most.`;
  return "";
}
