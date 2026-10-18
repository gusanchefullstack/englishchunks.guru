"use client";

import { ArrowLeft, ChevronsUpDown, CreditCard, LogOut, Palette, Shield, User } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

export type AccountMenuUser = {
  name: string;
  email: string;
  image: string | null;
  initials: string;
  subtitle?: string;
  isAdmin: boolean;
};

/**
 * Account menu: profile, billing, admin, theme and log out from anywhere (desktop sidebar card,
 * phone header avatar, admin header). `area` decides whether the switch link goes to the admin
 * console or back to the learner app.
 */
export function AccountMenu({
  user,
  variant,
  area = "app",
}: {
  user: AccountMenuUser;
  variant: "card" | "avatar";
  area?: "app" | "admin";
}) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  async function logOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  // Decorative: the trigger's name (visible name or aria-label) already identifies the person.
  const avatar = (size: string) => (
    <Avatar className={size} aria-hidden>
      {user.image ? <AvatarImage src={user.image} alt="" /> : null}
      <AvatarFallback className="bg-sky text-ink text-[10px] font-bold">
        {user.initials}
      </AvatarFallback>
    </Avatar>
  );

  return (
    // Not modal: a menu shouldn't aria-hide the page (axe aria-hidden-focus); Esc/outside click close it.
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className={cn(
          "outline-ring rounded-xl",
          variant === "card"
            ? "hover:bg-surface-subtle data-[state=open]:bg-surface-subtle flex w-full items-center gap-2.5 px-1 py-1 text-left"
            : "grid size-10 place-items-center rounded-full",
        )}
      >
        {variant === "card" ? (
          <>
            {avatar("size-9")}
            <span className="min-w-0 flex-1">
              <span className="sr-only">Account menu: </span>
              <span className="block truncate text-xs font-bold">{user.name}</span>
              {user.subtitle ? (
                <span className="text-muted-foreground block text-[11px]">{user.subtitle}</span>
              ) : null}
            </span>
            <ChevronsUpDown aria-hidden className="text-muted-foreground size-4" />
          </>
        ) : (
          <>
            {avatar("size-9")}
            <span className="sr-only">Account menu for {user.name}</span>
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={variant === "card" ? "start" : "end"}
        side={variant === "card" ? "top" : "bottom"}
        className="w-64"
      >
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-bold">{user.name}</span>
          <span className="text-muted-foreground block truncate text-xs">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User aria-hidden /> Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/billing">
            <CreditCard aria-hidden /> Plan &amp; billing
          </Link>
        </DropdownMenuItem>
        {area === "admin" ? (
          <DropdownMenuItem asChild>
            <Link href="/today">
              <ArrowLeft aria-hidden /> Learner app
            </Link>
          </DropdownMenuItem>
        ) : user.isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield aria-hidden /> Admin console
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette aria-hidden /> Theme
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
              <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={logOut}>
          <LogOut aria-hidden /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
