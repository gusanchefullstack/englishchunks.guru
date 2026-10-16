import { BookOpen, Check, Mic, PenLine, Star, Volume2 } from "lucide-react";
import type { SessionStep } from "@/db/schema";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "learn", label: "Learn", icon: BookOpen },
  { key: "speak", label: "Speak", icon: Mic },
  { key: "write", label: "Write", icon: PenLine },
  { key: "read_aloud", label: "Read aloud", icon: Volume2 },
  { key: "done", label: "Finish", icon: Star },
] as const;

const indexOf = (s: SessionStep) =>
  s === "learn"
    ? 0
    : s === "speak_1" || s === "speak_2"
      ? 1
      : s === "write"
        ? 2
        : s === "read_aloud"
          ? 3
          : 4;

/** Figma session stepper (Learn · Speak · Write · Read aloud · Finish). */
export function Stepper({ step }: { step: SessionStep }) {
  const current = indexOf(step);
  return (
    <ol aria-label="Session progress" className="flex items-start">
      {STEPS.map(({ key, label, icon: Icon }, i) => {
        const done = i < current || step === "done";
        const active = i === current && step !== "done";
        return (
          <li
            key={key}
            className="relative flex w-14 flex-col items-center gap-1.5 sm:w-[78px]"
            aria-current={active ? "step" : undefined}
          >
            {i < STEPS.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-[15px] left-[calc(50%+18px)] h-px w-[calc(100%-36px)]",
                  done ? "bg-primary" : "bg-border",
                )}
              />
            ) : null}
            <span
              className={cn(
                "grid size-[31px] place-items-center rounded-full",
                done
                  ? "bg-[#1dd6a4] text-white"
                  : active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground",
              )}
            >
              {done ? (
                <Check aria-hidden className="size-4" />
              ) : (
                <Icon aria-hidden className="size-4" />
              )}
            </span>
            <span
              className={cn(
                "text-center text-[10px] font-bold",
                active || done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
              <span className="sr-only">{done ? " (done)" : active ? " (current)" : ""}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
