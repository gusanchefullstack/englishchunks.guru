import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { Suspense } from "react";
import { db } from "@/db/client";
import { chunk } from "@/db/schema";
import { ProfileView } from "@/components/profile/profile-view";
import { getProfile } from "@/lib/domain/profile";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-96 animate-pulse rounded-[20px]" />}
    >
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  const learner = await learnerOrRedirect();
  const { user, voices } = await getProfile(learner.id);
  const [sample] = await db()
    .select({ id: chunk.id })
    .from(chunk)
    .where(eq(chunk.status, "active"))
    .limit(1);
  return (
    <ProfileView
      user={{
        name: user.name,
        email: user.email,
        image: user.image,
        level: user.level,
        motherTongue: user.motherTongue,
        timeZone: user.timeZone,
        voiceId: user.voiceId ?? voices[0]?.id ?? null,
        theme: user.theme,
        rankingVisible: user.rankingVisible,
        remindersEnabled: user.remindersEnabled,
        reminderHour: user.reminderHour,
        createdAt: user.createdAt,
        role: user.role,
      }}
      voices={voices.map((v) => ({ id: v.id, label: v.label }))}
      previewRef={sample ? `chunk:${sample.id}` : null}
    />
  );
}
