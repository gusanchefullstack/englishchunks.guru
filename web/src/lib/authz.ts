import "server-only";
import { headers } from "next/headers";
import type { CefrLevel } from "@/db/schema";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";

/** The subset of the session user that authorization decisions depend on. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  role?: string | null;
  banned?: boolean | null;
  level?: string | null;
  timeZone?: string | null;
};

export type Learner = SessionUser & { level: CefrLevel; timeZone: string };

/** Pure decision: may this user practice? (verified, not suspended, onboarded) */
export function authorizeLearner(
  u: SessionUser | null | undefined,
  opts: { allowNoLevel?: boolean } = {},
): SessionUser {
  if (!u) throw new AppError("unauthenticated", "Please sign in.");
  if (u.banned) throw new AppError("forbidden", "This account is suspended.");
  if (!u.emailVerified) throw new AppError("forbidden", "Please confirm your email first.");
  if (!u.level && !opts.allowNoLevel) {
    throw new AppError("needs_onboarding", "Choose your English level to start.");
  }
  return u;
}

/** Pure decision: is this user an admin? (FR-050) */
export function authorizeAdmin(u: SessionUser | null | undefined): SessionUser {
  const learner = authorizeLearner(u, { allowNoLevel: true });
  if (learner.role !== "admin") throw new AppError("forbidden", "Admins only.");
  return learner;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  // Read request headers first: during prerender this is where rendering stops, so the
  // auth client (and its env) is only touched at request time.
  const requestHeaders = await headers();
  const s = await auth().api.getSession({ headers: requestHeaders });
  return (s?.user as SessionUser | undefined) ?? null;
}

export async function requireLearner(): Promise<Learner> {
  return authorizeLearner(await getSessionUser()) as Learner;
}

export async function requireVerifiedUser(): Promise<SessionUser> {
  return authorizeLearner(await getSessionUser(), { allowNoLevel: true });
}

export async function requireAdmin(): Promise<SessionUser> {
  return authorizeAdmin(await getSessionUser());
}
