import { Suspense, type ReactNode } from "react";
import { Logo } from "./logo";
import { NotificationsBell } from "./notifications";
import { MobileTabBar, MobileTabLinks, SidebarLinks, SidebarNav } from "./sidebar-nav";
import { ThemeSwitch } from "./theme-switch";
import { UserSummary, UserSummarySkeleton } from "./user-summary";

/**
 * Learner app shell (Figma 2:380): 242px sidebar on desktop; top bar + bottom tabs below 1024px.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[242px_1fr]">
      <a
        href="#main"
        className="bg-primary text-primary-foreground sr-only z-50 rounded-lg px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>

      <aside className="bg-sidebar sticky top-0 hidden h-dvh flex-col border-r px-5 pt-7 pb-5 lg:flex">
        <div className="px-2 pb-8">
          <Logo />
        </div>
        <Suspense fallback={<SidebarLinks pathname={null} />}>
          <SidebarNav />
        </Suspense>
        <div className="flex items-center gap-2 pt-4">
          <div className="min-w-0 flex-1">
            <ThemeSwitch />
          </div>
          <Suspense fallback={<span className="size-10" />}>
            <NotificationsBell />
          </Suspense>
        </div>
        <div className="mt-auto pt-6">
          <Suspense fallback={<UserSummarySkeleton />}>
            <UserSummary />
          </Suspense>
        </div>
      </aside>

      <header className="bg-sidebar sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          <Suspense fallback={<span className="size-10" />}>
            <NotificationsBell />
          </Suspense>
          <div className="w-40">
            <ThemeSwitch />
          </div>
        </div>
      </header>

      <main
        id="main"
        tabIndex={-1}
        className="min-w-0 px-4 pt-6 pb-24 outline-none sm:px-8 lg:pt-10 lg:pb-16"
      >
        <div className="mx-auto w-full max-w-[1120px]">{children}</div>
      </main>

      <Suspense fallback={<MobileTabLinks pathname={null} />}>
        <MobileTabBar />
      </Suspense>
    </div>
  );
}
