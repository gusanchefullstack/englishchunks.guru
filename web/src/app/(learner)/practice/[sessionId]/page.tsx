import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { SessionFlow } from "@/components/session/session-flow";
import { SessionHeader, SessionSkeleton } from "@/components/session/session-header";
import { SummaryStep } from "@/components/session/summary-step";
import { getSession } from "@/lib/domain/session-engine";
import { AppError } from "@/lib/errors";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Practice" };

export default function PracticePage({ params }: PageProps<"/practice/[sessionId]">) {
  return (
    <Suspense fallback={<SessionSkeleton />}>
      <PracticeContent params={params} />
    </Suspense>
  );
}

async function PracticeContent({
  params,
}: {
  params: PageProps<"/practice/[sessionId]">["params"];
}) {
  const { sessionId } = await params;
  const learner = await learnerOrRedirect();
  const ctx = { userId: learner.id, level: learner.level, timeZone: learner.timeZone };
  let view;
  try {
    view = await getSession(ctx, sessionId);
  } catch (err) {
    if (err instanceof AppError && (err.code === "not_found" || err.code === "validation"))
      notFound();
    throw err;
  }
  const title = view.session.origin === "daily" ? "Today's chunk" : "Library practice";
  if (view.session.step === "done") {
    const [u] = await db()
      .select({ current: user.currentStreak, longest: user.longestStreak })
      .from(user)
      .where(eq(user.id, learner.id));
    return (
      <>
        <SessionHeader step="done" date={view.session.practiceDate} title={title} />
        <SummaryStep view={view} streak={u ?? { current: 0, longest: 0 }} />
      </>
    );
  }
  return (
    <>
      <SessionHeader step={view.session.step} date={view.session.practiceDate} title={title} />
      <SessionFlow view={view} />
    </>
  );
}
