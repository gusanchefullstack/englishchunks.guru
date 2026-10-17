import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { notification, practiceSession, user } from "@/db/schema";
import { renderEmail } from "@/emails/render";
import { ReminderEmail } from "@/emails/reminder";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { emailProvider } from "@/lib/providers/email";
import { displayStreak } from "./ranking";
import { localHour, practiceDateFor } from "./time";
import { unsubscribeToken } from "./unsubscribe";

/**
 * FR-033 hourly job: one reminder per learner per local day, at their chosen local hour,
 * only if they haven't completed a practice today. The unique (user, sent_on) reminder row is
 * claimed *before* sending, so overlapping runs can't double-send.
 */
export async function sendDueReminders(now = new Date()) {
  const d = db();
  const candidates = await d
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      tz: user.timeZone,
      hour: user.reminderHour,
      streak: user.currentStreak,
      last: user.lastPracticeDate,
    })
    .from(user)
    .where(
      and(
        eq(user.remindersEnabled, true),
        eq(user.emailVerified, true),
        sql`coalesce(${user.banned}, false) = false`,
        sql`${user.level} is not null`,
      ),
    );
  const due = candidates.filter((c) => localHour(c.tz, now) === c.hour);
  if (!due.length) return { considered: candidates.length, sent: 0 };

  const practicedRows = await d
    .select({ userId: practiceSession.userId, date: practiceSession.practiceDate })
    .from(practiceSession)
    .where(
      and(
        inArray(
          practiceSession.userId,
          due.map((c) => c.id),
        ),
        eq(practiceSession.status, "completed"),
      ),
    );
  const practiced = new Set(practicedRows.map((r) => `${r.userId}|${r.date}`));
  const appUrl = env().BETTER_AUTH_URL.replace(/\/$/, "");

  let sent = 0;
  for (const c of due) {
    const today = practiceDateFor(c.tz, now);
    if (practiced.has(`${c.id}|${today}`)) continue;
    const claimed = await d
      .insert(notification)
      .values({
        userId: c.id,
        type: "reminder",
        channel: "email",
        message: "Daily practice reminder",
        sentOn: today,
      })
      .onConflictDoNothing()
      .returning({ id: notification.id });
    if (!claimed.length) continue;
    const token = unsubscribeToken(c.id);
    const unsubscribeUrl = `${appUrl}/unsubscribe?token=${encodeURIComponent(token)}`;
    const { html, text } = await renderEmail(
      ReminderEmail({
        name: c.name,
        streak: displayStreak(c.streak, c.last, c.tz, now),
        appUrl,
        unsubscribeUrl,
      }),
    );
    try {
      await emailProvider().send({
        to: c.email,
        subject: "Your chunk for today is waiting",
        html,
        text,
        headers: {
          // RFC 8058 one-click unsubscribe (mailbox providers' bulk-sender rules).
          "List-Unsubscribe": `<${appUrl}/api/unsubscribe?token=${encodeURIComponent(token)}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });
      sent++;
    } catch {
      // Release the claim so the next hourly run can retry today.
      await d.delete(notification).where(eq(notification.id, claimed[0]!.id));
      logger.warn({ event: "reminder.failed" }, "reminder email failed");
    }
  }
  return { considered: candidates.length, sent };
}
