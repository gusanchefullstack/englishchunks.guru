import { BookOpen, LayoutGrid, Sparkles, TrendingUp, User, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon; badge?: string };

/** Figma 2:380 sidebar navigation. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/today", label: "Today", icon: LayoutGrid },
  { href: "/library", label: "Chunk library", icon: BookOpen },
  { href: "/conversation", label: "Guru conversation", icon: Sparkles, badge: "Pro" },
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: User },
];
