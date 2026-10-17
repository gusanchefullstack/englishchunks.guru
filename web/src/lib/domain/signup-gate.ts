import { createHash, randomBytes } from "node:crypto";
import { and, count, eq, gt, lt, ne } from "drizzle-orm";
import { db, type Tx } from "@/db/client";
import { appSetting, user, waitlistEntry } from "@/db/schema";

const INVITE_DAYS = 7;
export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Accounts counting toward the cap: every learner account (admins excluded). Deletion frees a place. */
export async function accountCount(tx?: Tx) {
  const [r] = await (tx ?? db()).select({ n: count() }).from(user).where(ne(user.role, "admin"));
  return r?.n ?? 0;
}

export async function signupOpen(tx?: Tx) {
  const [s] = await (tx ?? db()).select().from(appSetting).limit(1);
  if (!s || s.billingActive) return { open: true, cap: s?.accountCap ?? 0, count: 0 };
  const n = await accountCount(tx);
  return { open: n < s.accountCap, cap: s.accountCap, count: n };
}

/** A valid invite: hash matches, status invited, not expired, and for the same email. */
export async function validInvite(token: string | undefined | null, email: string) {
  if (!token) return null;
  const [e] = await db()
    .select()
    .from(waitlistEntry)
    .where(
      and(
        eq(waitlistEntry.inviteTokenHash, hashToken(token)),
        eq(waitlistEntry.status, "invited"),
        gt(waitlistEntry.inviteExpiresAt, new Date()),
      ),
    );
  return e && e.email === email.toLowerCase() ? e : null;
}

/** FR-055 gate: billing active OR under the cap OR a valid invite for this email. */
export async function mayCreateAccount(email: string, inviteToken?: string | null) {
  if ((await signupOpen()).open) return true;
  return Boolean(await validInvite(inviteToken, email));
}

export async function markInviteUsed(email: string) {
  await db()
    .update(waitlistEntry)
    .set({ status: "registered", inviteTokenHash: null })
    .where(eq(waitlistEntry.email, email.toLowerCase()));
}

/** Idempotent join; never reveals whether the email already exists. */
export async function joinWaitlist(email: string) {
  await db().insert(waitlistEntry).values({ email: email.toLowerCase() }).onConflictDoNothing();
}

/** Admin: invite people (single-use token, 7 days). Returns tokens to email (never stored). */
export async function inviteEntries(adminId: string, ids: string[], now = new Date()) {
  const out: { email: string; token: string }[] = [];
  for (const id of ids) {
    const token = randomBytes(32).toString("base64url");
    const [row] = await db()
      .update(waitlistEntry)
      .set({
        status: "invited",
        inviteTokenHash: hashToken(token),
        invitedBy: adminId,
        invitedAt: now,
        inviteExpiresAt: new Date(now.getTime() + INVITE_DAYS * 86_400_000),
      })
      .where(and(eq(waitlistEntry.id, id), ne(waitlistEntry.status, "registered")))
      .returning({ email: waitlistEntry.email });
    if (row) out.push({ email: row.email, token });
  }
  return out;
}

export async function expireInvites(now = new Date()) {
  const rows = await db()
    .update(waitlistEntry)
    .set({ status: "expired", inviteTokenHash: null })
    .where(and(eq(waitlistEntry.status, "invited"), lt(waitlistEntry.inviteExpiresAt, now)))
    .returning({ id: waitlistEntry.id });
  return rows.length;
}

export async function listWaitlist() {
  return db().select().from(waitlistEntry).orderBy(waitlistEntry.createdAt);
}

export async function setAccountCap(cap: number) {
  await db().update(appSetting).set({ accountCap: cap }).where(eq(appSetting.id, 1));
}
