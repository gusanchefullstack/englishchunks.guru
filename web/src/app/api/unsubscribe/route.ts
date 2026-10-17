import { unsubscribeReminders } from "@/lib/domain/unsubscribe";

/** RFC 8058 one-click unsubscribe (POST from the mailbox provider; no sign-in). */
export async function POST(request: Request) {
  const ok = await unsubscribeReminders(new URL(request.url).searchParams.get("token"));
  return new Response(null, { status: ok ? 200 : 400 });
}
