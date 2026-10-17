import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/domain/reminders";
import { expireInvites } from "@/lib/domain/signup-gate";

/** Called hourly by the Droplet systemd timer (research R14). */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return new Response(null, { status: 401 });
  const reminders = await sendDueReminders();
  const expiredInvites = await expireInvites();
  return Response.json({ reminders, expiredInvites });
}
