import { ChevronRight, Flame } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getSessionUser } from "@/lib/authz";
import { getShellSummary, initials, LEVEL_LABELS } from "@/lib/domain/shell";

/** Streak card + user card (Figma sidebar bottom). Reads the session → render inside <Suspense>. */
export async function UserSummary() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return null;
  const s = await getShellSummary(sessionUser.id);
  if (!s) return null;
  const level = s.level ? `${s.level} · ${LEVEL_LABELS[s.level]}` : "Level not set";
  return (
    <div className="grid gap-4">
      <div className="bg-streak border-streak-border rounded-[15px] border p-4 shadow-[inset_3px_0_0_0_var(--lavender)]">
        <p className="text-streak-foreground flex items-center gap-2 text-base font-bold">
          <Flame aria-hidden className="size-5" />
          {s.currentStreak} day streak
        </p>
        <p className="text-streak-foreground/90 mt-1 text-[11px]">
          {s.currentStreak > 0
            ? "Keep it glowing—you're building a real habit."
            : "Practice today to start your streak."}
        </p>
      </div>
      <Link
        href="/profile"
        className="hover:bg-muted flex items-center gap-2.5 rounded-xl px-1 py-1"
      >
        <Avatar className="size-9">
          {s.image ? <AvatarImage src={s.image} alt="" /> : null}
          <AvatarFallback className="bg-sky text-ink text-[10px] font-bold">
            {initials(s.name)}
          </AvatarFallback>
        </Avatar>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold">{s.name}</span>
          <span className="text-muted-foreground block text-[11px]">{level}</span>
        </span>
        <ChevronRight aria-hidden className="text-muted-foreground size-4" />
      </Link>
    </div>
  );
}

export function UserSummarySkeleton() {
  return <div aria-hidden className="bg-muted h-36 animate-pulse rounded-[15px]" />;
}
