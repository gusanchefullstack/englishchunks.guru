import type { Metadata } from "next";
import { Suspense } from "react";
import { Logo } from "@/components/app-shell/logo";
import { UnsubscribeForm } from "@/components/unsubscribe-form";

export const metadata: Metadata = { title: "Daily reminders" };

/** Reminder-email link target: confirm with one click, no sign-in needed (FR-033). */
export default function UnsubscribePage() {
  return (
    <main id="main" className="mx-auto max-w-md px-5 py-16">
      <Logo />
      <h1 className="mt-10 text-[34px] leading-tight tracking-[-1px]">Stop daily reminders?</h1>
      <p className="text-muted-foreground mt-2">
        We&apos;ll stop the daily practice email. Your account and progress stay as they are.
      </p>
      <Suspense>
        <UnsubscribeForm />
      </Suspense>
    </main>
  );
}
