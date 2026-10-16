import type { SessionStep } from "@/db/schema";
import { Stepper } from "./stepper";
import { Eyebrow } from "./ui";

export function SessionHeader({
  step,
  date,
  title,
}: {
  step: SessionStep;
  date: string;
  title: string;
}) {
  const label = new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b pb-6">
      <div>
        <Eyebrow>{label}</Eyebrow>
        <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">{title}</h1>
      </div>
      <Stepper step={step} />
    </header>
  );
}

export function SessionSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading your session" className="grid gap-5">
      <div className="bg-muted h-16 w-64 animate-pulse rounded-xl" />
      <div className="bg-muted h-80 animate-pulse rounded-[20px]" />
    </div>
  );
}
