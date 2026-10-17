import { Check } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

const PLANS = [
  { tier: "Basic", price: 7, practices: 1, extras: [] as string[] },
  { tier: "Standard", price: 9, practices: 3, extras: [] },
  {
    tier: "Premium",
    price: 11,
    practices: 5,
    extras: ["1 daily conversation with Guru (coming soon)"],
  },
];

/** FR-061/FR-062: while billing is inactive, Basic is free and the others are "coming soon". */
export function Plans({ billingActive }: { billingActive: boolean }) {
  return (
    <ul className="grid gap-4 md:grid-cols-3">
      {PLANS.map((p) => {
        const soon = !billingActive && p.tier !== "Basic";
        const free = !billingActive && p.tier === "Basic";
        return (
          <li
            key={p.tier}
            className={cn(
              "bg-card flex flex-col rounded-[20px] border p-6",
              p.tier === "Standard" && "border-[#1dd6a4]",
            )}
          >
            <h3 className="text-xl font-bold">{p.tier}</h3>
            <p className="mt-2">
              {free ? (
                <>
                  <span className="text-4xl font-bold">Free</span>{" "}
                  <span className="text-muted-foreground text-sm">while we&apos;re testing</span>
                </>
              ) : (
                <>
                  <span className="text-4xl font-bold">${p.price}</span>{" "}
                  <span className="text-muted-foreground text-sm">/ month</span>
                </>
              )}
            </p>
            <ul className="mt-4 grid flex-1 gap-2 text-sm">
              <li className="flex gap-2">
                <Check aria-hidden className="text-nav-active-foreground size-4" /> {p.practices}{" "}
                chunk practice{p.practices > 1 ? "s" : ""} a day
              </li>
              <li className="flex gap-2">
                <Check aria-hidden className="text-nav-active-foreground size-4" /> Pronunciation
                scores and tips
              </li>
              <li className="flex gap-2">
                <Check aria-hidden className="text-nav-active-foreground size-4" /> Writing feedback
              </li>
              {p.extras.map((e) => (
                <li key={e} className="flex gap-2">
                  <Check aria-hidden className="text-nav-active-foreground size-4" /> {e}
                </li>
              ))}
            </ul>
            {soon ? (
              <p className="bg-muted mt-5 rounded-xl px-4 py-3 text-center text-sm font-bold">
                Coming soon
              </p>
            ) : (
              <Link
                href="/sign-up"
                className="bg-primary text-primary-foreground mt-5 rounded-xl px-4 py-3 text-center font-bold"
              >
                {billingActive ? "Start 7-day free trial" : "Start free"}
                <span className="sr-only"> on {p.tier}</span>
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}
