import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-eyebrow text-xs font-bold tracking-[1.7px] uppercase", className)}>
      {children}
    </p>
  );
}

export function Tag({ children, tone = "type" }: { children: ReactNode; tone?: "type" | "level" }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-1.5 text-[10px] leading-none font-bold tracking-[1px] uppercase",
        tone === "type"
          ? "bg-tag-type text-tag-type-foreground"
          : "bg-tag-level text-tag-level-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-[20px] border p-6 sm:p-8", className)}>{children}</div>
  );
}

export function CoachCard({
  label = "Mina's tip",
  children,
}: {
  label?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-coach text-coach-foreground flex gap-3.5 rounded-[18px] p-6">
      <span
        aria-hidden
        className="bg-primary text-primary-foreground grid size-9 shrink-0 place-items-center rounded-full font-bold"
      >
        M
      </span>
      <div>
        <p className="text-mint text-[10px] font-bold tracking-[1.3px] uppercase">{label}</p>
        <div className="mt-2 text-base leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="bg-card mt-7 flex flex-wrap items-center justify-between gap-3 rounded-[15px] border px-5 py-4">
      {children}
    </div>
  );
}

export const primaryBtn =
  "bg-primary text-primary-foreground inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl px-5 font-bold transition-opacity disabled:opacity-50";
export const ghostBtn =
  "bg-card inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 font-bold hover:bg-muted disabled:opacity-50";
