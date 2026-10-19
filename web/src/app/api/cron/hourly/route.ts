import { isCronAuthorized } from "@/lib/cron-auth";
import { prunePracticeEvents } from "@/lib/domain/practice-events";
import { sendDueReminders } from "@/lib/domain/reminders";
import { expireInvites } from "@/lib/domain/signup-gate";

/** Called hourly by the Droplet systemd timer (research R14). */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return new Response(null, { status: 401 });
  const reminders = await sendDueReminders();
  const expiredInvites = await expireInvites();
  const prunedEvents = await prunePracticeEvents();
  return Response.json({ reminders, expiredInvites, prunedEvents });
}
