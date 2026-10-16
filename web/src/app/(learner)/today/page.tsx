import { CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SessionSkeleton } from "@/components/session/session-header";
import { Card, Eyebrow, primaryBtn } from "@/components/session/ui";
import { StartTodayButton } from "@/components/session/start-today";
import { getTodayStatus } from "@/lib/domain/session-engine";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Today" };

export default function TodayPage() {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <TodayContent />
    </Suspense>
  );
}

async function TodayContent() {
  const learner = await learnerOrRedirect();
  const status = await getTodayStatus({
    userId: learner.id,
    level: learner.level,
    timeZone: learner.timeZone,
  });
  if (status.existingSessionId) redirect(`/practice/${status.existingSessionId}`);
  if (status.remaining === 0) {
    const { nextDayStart } = await import("@/lib/domain/time");
    return (
      <LimitReached resetsAt={nextDayStart(learner.timeZone).toISOString()} limit={status.limit} />
    );
  }
  return (
    <section aria-labelledby="today-title" className="mx-auto max-w-xl text-center">
      <Eyebrow>Your daily English ritual</Eyebrow>
      <h1 id="today-title" className="mt-2 text-[34px] tracking-[-1px]">
        Today&apos;s chunk is ready
      </h1>
      <Card className="mt-6">
        <p>
          One useful chunk. About twelve focused minutes: learn it, say it twice, write it, read it
          aloud.
        </p>
        <div className="mt-5">
          <StartTodayButton />
        </div>
      </Card>
    </section>
  );
}

function LimitReached({ resetsAt, limit }: { resetsAt: string; limit: number }) {
  const time = resetsAt
    ? new Date(resetsAt).toLocaleString("en-US", {
        weekday: "long",
        hour: "numeric",
        minute: "2-digit",
      })
    : "tomorrow";
  return (
    <section aria-labelledby="limit-title" className="mx-auto max-w-xl text-center">
      <Eyebrow>Today</Eyebrow>
      <h1 id="limit-title" className="mt-2 text-[34px] tracking-[-1px]">
        {limit === 0 ? "Choose a plan to keep going" : "You've done today's practice!"}
      </h1>
      <Card className="mt-6">
        <CalendarClock aria-hidden className="mx-auto size-8" />
        <p className="mt-3">
          {limit === 0 ? "Your free trial has ended." : `Your next practice unlocks ${time}.`}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Standard and Premium plans include more practices each day.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Link href="/progress" className={primaryBtn}>
            See my progress
          </Link>
        </div>
      </Card>
    </section>
  );
}
