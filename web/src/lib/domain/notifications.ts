import { and, desc, eq, isNull } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { notification } from "@/db/schema";

type NotificationType = "submission_accepted" | "submission_rejected" | "billing" | "system";

export async function notifyInApp(tx: Tx, userId: string, type: NotificationType, message: string) {
  await tx.insert(notification).values({ userId, type, channel: "in_app", message });
}

export async function listNotifications(userId: string, limit = 10) {
  const rows = await db()
    .select()
    .from(notification)
    .where(and(eq(notification.userId, userId), eq(notification.channel, "in_app")))
    .orderBy(desc(notification.createdAt))
    .limit(limit);
  return { items: rows, unread: rows.filter((r) => !r.readAt).length };
}

export async function markAllRead(userId: string) {
  await db()
    .update(notification)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(notification.userId, userId),
        eq(notification.channel, "in_app"),
        isNull(notification.readAt),
      ),
    );
}
