"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/chunks", label: "Chunks" },
  { href: "/admin/submissions", label: "Submissions" },
  { href: "/admin/waitlist", label: "Waitlist" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/today", label: "Back to app" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex flex-wrap gap-1">
      {ITEMS.map((i) => {
        const active = i.href === "/admin" ? path === "/admin" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-lg px-3 py-2 text-sm font-bold",
              active
                ? "bg-nav-active text-nav-active-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
