import { NotificationsBellView } from "@/components/notifications-bell";
import { getSessionUser } from "@/lib/authz";
import { listNotifications } from "@/lib/domain/notifications";

/** Reads the session → render inside <Suspense>. */
export async function NotificationsBell() {
  const u = await getSessionUser();
  if (!u) return null;
  const { items, unread } = await listNotifications(u.id);
  return <NotificationsBellView items={items} unread={unread} />;
}
