import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, authorizeLearner, type Learner } from "@/lib/authz";
import { AppError } from "@/lib/errors";

/** For pages: redirect instead of throwing when the visitor can't use learner pages yet. */
export async function learnerOrRedirect(): Promise<Learner> {
  const u = await getSessionUser();
  try {
    return authorizeLearner(u) as Learner;
  } catch (err) {
    if (err instanceof AppError) {
      if (err.code === "unauthenticated") redirect("/sign-in");
      if (err.code === "needs_onboarding") redirect("/onboarding/level");
      if (err.code === "forbidden" && u && !u.emailVerified)
        redirect(`/verify-email?email=${encodeURIComponent(u.email)}`);
    }
    throw err;
  }
}

/** For onboarding pages: signed in and verified, level not required yet. */
export async function verifiedOrRedirect() {
  const u = await getSessionUser();
  if (!u) redirect("/sign-in");
  if (!u.emailVerified) redirect(`/verify-email?email=${encodeURIComponent(u.email)}`);
  if (u.banned) redirect("/sign-in");
  return u;
}
