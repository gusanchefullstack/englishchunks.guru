import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReminders } from "@/lib/domain/reminders";

/** Called hourly by the Droplet systemd timer (research R14). */
export async function POST(request: Request) {
  if (!isCronAuthorized(request)) return new Response(null, { status: 401 });
  const reminders = await sendDueReminders();
  return Response.json({ reminders });
}
