import { Suspense } from "react";
import { AdminNav } from "@/components/admin/admin-nav";
import { Logo } from "@/components/app-shell/logo";
import { adminOrNotFound } from "@/lib/admin-guard";
import { pendingModerationCount } from "@/lib/domain/admin-chunks";

/** Admin area. proxy.ts returns 404 to non-admins; each page/action still calls authorizeAdmin(). */
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="min-h-dvh">
      <header className="bg-sidebar border-b">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-6 px-5 py-3">
          <Logo />
          <span className="bg-tag-type text-tag-type-foreground rounded px-2 py-1 text-[10px] font-black tracking-wide uppercase">
            Admin
          </span>
          <Suspense fallback={null}>
            <NavWithCounts />
          </Suspense>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-8">
        {children}
      </main>
    </div>
  );
}

async function NavWithCounts() {
  await adminOrNotFound();
  return <AdminNav pending={await pendingModerationCount()} />;
}
