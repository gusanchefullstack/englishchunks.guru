import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { WaitlistForm } from "@/components/auth/waitlist-form";
import { signupOpen } from "@/lib/domain/signup-gate";

export const metadata: Metadata = { title: "Create your account" };

type Search = { invite?: string; email?: string };

export default function SignUpPage({ searchParams }: PageProps<"/sign-up">) {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-[520px] animate-pulse rounded-2xl" />}
    >
      <Gate searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

/** FR-055: at the account cap, visitors get the waitlist unless they arrive with an invite. */
async function Gate({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const { open } = await signupOpen();
  if (open || sp.invite) return <SignUpForm invite={sp.invite} invitedEmail={sp.email} />;
  return (
    <div>
      <p className="text-brand-link text-xs font-bold tracking-[1.3px] uppercase">
        We&apos;re almost full
      </p>
      <h1 className="mt-3 text-[34px] leading-tight tracking-[-1px]">Join the waitlist</h1>
      <p className="text-muted-foreground mt-2">
        We&apos;re keeping the free test group small. Leave your email and we&apos;ll invite you as
        soon as a spot opens.
      </p>
      <WaitlistForm email={sp.email} />
    </div>
  );
}
