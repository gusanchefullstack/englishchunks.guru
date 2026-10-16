"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Switch } from "@/components/ui/switch";

const subscribe = () => () => {};

/** Light/dark toggle (Figma "Light mode" switch). Persists via next-themes; profile sync in US2. */
export function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const dark = mounted && resolvedTheme === "dark";
  return (
    <label className="bg-background flex h-11 items-center gap-2 rounded-[10px] border px-3 text-xs font-bold">
      {dark ? <Moon aria-hidden className="size-4" /> : <Sun aria-hidden className="size-4" />}
      <span className="flex-1">{dark ? "Dark mode" : "Light mode"}</span>
      <Switch
        checked={dark}
        onCheckedChange={(on) => setTheme(on ? "dark" : "light")}
        aria-label="Dark mode"
        disabled={!mounted}
      />
    </label>
  );
}
