import "server-only";
import { notFound } from "next/navigation";
import { authorizeAdmin, getSessionUser, type SessionUser } from "@/lib/authz";

/** Server-side admin check for pages (FR-050); unknown to non-admins. */
export async function adminOrNotFound(): Promise<SessionUser> {
  try {
    return authorizeAdmin(await getSessionUser());
  } catch {
    notFound();
  }
}
