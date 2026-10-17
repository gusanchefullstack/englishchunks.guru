import "server-only";
import { and, count, desc, eq, ilike, isNull, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { cefrLevels, planTiers, practiceSession, session, subscription, user } from "@/db/schema";
import { auth } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { deleteAccount } from "./account-deletion";
import { logAdmin } from "./audit";

export const UserFilter = z.object({
  q: z.string().trim().max(80).optional().catch(undefined),
  plan: z.enum(planTiers).optional().catch(undefined),
  status: z.enum(["active", "unverified", "suspended"]).optional().catch(undefined),
  level: z.enum(cefrLevels).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});
const PAGE = 25;

/** FR-051: searchable, filterable user list with plan + subscription status + renewal date. */
export async function listUsers(raw: unknown) {
  const f = UserFilter.parse(raw ?? {});
  const conds: (SQL | undefined)[] = [];
  if (f.q)
    conds.push(
      or(
        ilike(user.email, `%${f.q}%`),
        ilike(user.username, `%${f.q}%`),
        ilike(user.name, `%${f.q}%`),
      ),
    );
  if (f.level) conds.push(eq(user.level, f.level));
  if (f.status === "suspended") conds.push(eq(user.banned, true));
  if (f.status === "unverified")
    conds.push(and(eq(user.emailVerified, false), sql`coalesce(${user.banned}, false) = false`));
  if (f.status === "active")
    conds.push(and(eq(user.emailVerified, true), sql`coalesce(${user.banned}, false) = false`));
  // Learners without a subscription row are on free Basic.
  if (f.plan === "basic") conds.push(or(eq(subscription.tier, "basic"), isNull(subscription.tier)));
  else if (f.plan) conds.push(eq(subscription.tier, f.plan));
  const where = and(...conds);
  const page = f.page ?? 1;
  const base = db()
    .select({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      level: user.level,
      role: user.role,
      emailVerified: user.emailVerified,
      banned: user.banned,
      createdAt: user.createdAt,
      lastActiveAt: user.lastActiveAt,
      tier: sql<string>`coalesce(${subscription.tier}, 'basic')`,
      subStatus: sql<string>`coalesce(${subscription.status}, 'free_basic')`,
      renewsAt: subscription.currentPeriodEnd,
    })
    .from(user)
    .leftJoin(subscription, eq(subscription.userId, user.id))
    .where(where);
  const [rows, [{ total } = { total: 0 }]] = await Promise.all([
    base
      .orderBy(desc(user.createdAt))
      .limit(PAGE)
      .offset((page - 1) * PAGE),
    db()
      .select({ total: count() })
      .from(user)
      .leftJoin(subscription, eq(subscription.userId, user.id))
      .where(where),
  ]);
  return { filter: f, rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) };
}

/** FR-052: payment method summary only — type, brand, last4, expiry. */
export async function getUserDetail(id: string) {
  const [u] = await db().select().from(user).where(eq(user.id, id));
  if (!u) throw new AppError("not_found", "User not found.");
  const [sub] = await db().select().from(subscription).where(eq(subscription.userId, id));
  const [{ sessions } = { sessions: 0 }] = await db()
    .select({ sessions: count() })
    .from(practiceSession)
    .where(and(eq(practiceSession.userId, id), eq(practiceSession.status, "completed")));
  return {
    user: {
      id: u.id,
      name: u.name,
      username: u.username,
      email: u.email,
      role: u.role,
      level: u.level,
      emailVerified: u.emailVerified,
      banned: Boolean(u.banned),
      banReason: u.banReason,
      createdAt: u.createdAt,
      lastActiveAt: u.lastActiveAt,
      totalPoints: u.totalPoints,
      currentStreak: u.currentStreak,
      earlyTester: u.earlyTester,
    },
    subscription: {
      tier: sub?.tier ?? "basic",
      status: sub?.status ?? "free_basic",
      trialEndsAt: sub?.trialEndsAt ?? null,
      renewsAt: sub?.currentPeriodEnd ?? null,
      cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
      paymentMethod: sub?.pmLast4
        ? {
            type: "card",
            brand: sub.pmBrand,
            last4: sub.pmLast4,
            expMonth: sub.pmExpMonth,
            expYear: sub.pmExpYear,
          }
        : null,
    },
    stats: { sessions },
  };
}

export const CreateUser = z.object({
  name: z.string().trim().min(1).max(40),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/),
  email: z.email().transform((e) => e.toLowerCase()),
  password: z.string().min(8),
  level: z.enum(cefrLevels),
  role: z.enum(["learner", "admin"]).default("learner"),
});

export async function createUser(adminId: string, raw: unknown) {
  const input = CreateUser.parse(raw);
  const res = await auth()
    .api.createUser({
      body: {
        email: input.email,
        password: input.password,
        name: input.name,
        role: input.role as "user",
        data: {
          username: input.username,
          level: input.level,
          emailVerified: true,
          ageConfirmedAt: new Date(),
        },
      },
    })
    .catch((err: Error) => {
      throw new AppError(
        "conflict",
        /exist/i.test(err.message)
          ? "That email or username is already used."
          : "Could not create the user.",
      );
    });
  await logAdmin(adminId, "user.create", res.user.id, { role: input.role });
  return { id: res.user.id };
}

export const UpdateUser = z.object({
  name: z.string().trim().min(1).max(40).optional(),
  level: z.enum(cefrLevels).optional(),
  role: z.enum(["learner", "admin"]).optional(),
});

export async function updateUser(adminId: string, id: string, raw: unknown) {
  const patch = UpdateUser.parse(raw);
  if (patch.role && id === adminId)
    throw new AppError("validation", "You can't change your own role.");
  const [row] = await db()
    .update(user)
    .set(patch)
    .where(eq(user.id, id))
    .returning({ id: user.id });
  if (!row) throw new AppError("not_found", "User not found.");
  await logAdmin(adminId, "user.update", id, { fields: Object.keys(patch) });
  return row;
}

export async function setSuspended(
  adminId: string,
  id: string,
  suspended: boolean,
  reason?: string,
) {
  if (id === adminId) throw new AppError("validation", "You can't suspend yourself.");
  await db().transaction(async (tx) => {
    const [row] = await tx
      .update(user)
      .set({ banned: suspended, banReason: suspended ? reason || "Suspended by an admin" : null })
      .where(eq(user.id, id))
      .returning({ id: user.id });
    if (!row) throw new AppError("not_found", "User not found.");
    if (suspended) await tx.delete(session).where(eq(session.userId, id)); // sign out everywhere
    await logAdmin(adminId, suspended ? "user.suspend" : "user.unsuspend", id, {}, tx);
  });
}

export async function removeUser(adminId: string, id: string) {
  if (id === adminId)
    throw new AppError("validation", "Delete your own account from your profile.");
  await deleteAccount(id);
  await logAdmin(adminId, "user.delete", id);
}
