import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Admin area: answer non-admins with a real 404 before any rendering starts (streamed pages
 * can't change their status later). This is an optimistic gate only — every admin page and
 * action still enforces `authorizeAdmin()` server-side (FR-050).
 */
export async function proxy(request: NextRequest) {
  const session = await auth()
    .api.getSession({ headers: request.headers })
    .catch(() => null);
  const u = session?.user as { role?: string; banned?: boolean | null } | undefined;
  if (u?.role === "admin" && !u.banned) return NextResponse.next();
  return NextResponse.rewrite(new URL("/_not-found", request.url), { status: 404 });
}

export const config = { matcher: ["/admin/:path*"] };
