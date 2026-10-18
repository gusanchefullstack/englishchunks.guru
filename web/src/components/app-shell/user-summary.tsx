import { Flame } from "lucide-react";
import { getSessionUser } from "@/lib/authz";
import { getShellSummary, initials, LEVEL_LABELS } from "@/lib/domain/shell";
import { AccountMenu, type AccountMenuUser } from "./account-menu";

async function accountUser(): Promise<(AccountMenuUser & { streak: number }) | null> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  const s = await getShellSummary(sessionUser.id);
  if (!s) return null;
  return {
    name: s.name,
    email: sessionUser.email,
    image: s.image,
    initials: initials(s.name),
    subtitle: s.level ? `${s.level} · ${LEVEL_LABELS[s.level]}` : "Level not set",
    isAdmin: sessionUser.role === "admin",
    streak: s.currentStreak,
  };
}

/** Avatar button that opens the account menu (phone header, admin header). */
export async function HeaderAccount({ area = "app" }: { area?: "app" | "admin" }) {
  const u = await accountUser();
  return u ? <AccountMenu user={u} variant="avatar" area={area} /> : null;
}

/** Streak card + user card (Figma sidebar bottom). Reads the session → render inside <Suspense>. */
export async function UserSummary() {
  const u = await accountUser();
  if (!u) return null;
  return (
    <div className="grid gap-4">
      <div className="bg-streak border-streak-border rounded-[15px] border p-4 shadow-[inset_3px_0_0_0_var(--lavender)]">
        <p className="text-streak-foreground flex items-center gap-2 text-base font-bold">
          <Flame aria-hidden className="size-5" />
          {u.streak} day streak
        </p>
        <p className="text-streak-foreground/90 mt-1 text-[11px]">
          {u.streak > 0
            ? "Keep it glowing—you're building a real habit."
            : "Practice today to start your streak."}
        </p>
      </div>
      <AccountMenu user={u} variant="card" />
    </div>
  );
}

export function UserSummarySkeleton() {
  return <div aria-hidden className="bg-muted h-36 animate-pulse rounded-[15px]" />;
}
