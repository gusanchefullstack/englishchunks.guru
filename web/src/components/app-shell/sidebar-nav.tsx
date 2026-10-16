"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return (
    pathname === href ||
    pathname.startsWith(`${href}/`) ||
    (href === "/today" && pathname.startsWith("/practice"))
  );
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="grid gap-1.5">
      {NAV_ITEMS.map(({ href, label, icon: Icon, badge }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-12 items-center gap-3.5 rounded-[10px] px-3.5 text-base font-semibold transition-colors",
              active
                ? "bg-nav-active text-nav-active-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon aria-hidden className="size-5 shrink-0" />
            <span className="flex-1">{label}</span>
            {badge ? (
              <span className="bg-tag-type text-tag-type-foreground rounded px-1.5 py-0.5 text-[10px] font-black tracking-wide uppercase">
                {badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom tab bar for phones and tablets (< 1024px). */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="bg-card fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-bold",
              active ? "text-nav-active-foreground" : "text-muted-foreground",
            )}
          >
            <Icon aria-hidden className="size-5" />
            <span className="max-w-full truncate px-1">
              {label === "Guru conversation"
                ? "Guru"
                : label === "Chunk library"
                  ? "Library"
                  : label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
