import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db } from "@/db/client";
import { user } from "@/db/schema";
import { AboutForm } from "@/components/onboarding/about-form";
import { StepHeader } from "@/components/onboarding/step-header";
import { verifiedOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "About you" };

export default function AboutPage() {
  return (
    <>
      <StepHeader step={2} />
      <Suspense
        fallback={
          <div
            aria-busy="true"
            className="bg-muted mx-auto h-80 max-w-md animate-pulse rounded-2xl"
          />
        }
      >
        <AboutContent />
      </Suspense>
    </>
  );
}

async function AboutContent() {
  const u = await verifiedOrRedirect();
  if (!u.level) redirect("/onboarding/level");
  const [row] = await db()
    .select({ motherTongue: user.motherTongue, reminderHour: user.reminderHour })
    .from(user)
    .where(eq(user.id, u.id));
  return (
    <AboutForm motherTongue={row?.motherTongue ?? null} reminderHour={row?.reminderHour ?? 19} />
  );
}
