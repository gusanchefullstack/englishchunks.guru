import type { Metadata } from "next";
import { Suspense } from "react";
import { LevelPicker } from "@/components/onboarding/level-picker";
import { StepHeader } from "@/components/onboarding/step-header";
import { verifiedOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Your English level" };

export default function LevelPage() {
  return (
    <>
      <StepHeader step={1} />
      <Suspense
        fallback={
          <div
            aria-busy="true"
            className="bg-muted mx-auto h-96 max-w-xl animate-pulse rounded-2xl"
          />
        }
      >
        <LevelContent />
      </Suspense>
    </>
  );
}

async function LevelContent() {
  const u = await verifiedOrRedirect();
  // Changing level later (from the profile) skips step 2.
  const next = u.level ? "/today" : "/onboarding/about";
  return <LevelPicker current={u.level ?? null} needsAge={!u.ageConfirmedAt} next={next} />;
}
