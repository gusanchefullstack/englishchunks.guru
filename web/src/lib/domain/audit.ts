import { desc } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { adminAuditLog } from "@/db/schema";

/** Admin audit trail (no personal content in `details`). */
export async function logAdmin(
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown> = {},
  tx?: Tx,
) {
  await (tx ?? db()).insert(adminAuditLog).values({ actorId, action, targetId, details });
}

export async function recentAudit(limit = 20) {
  return db().select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
}
