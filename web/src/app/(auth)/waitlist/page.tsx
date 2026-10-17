import type { Metadata } from "next";
import { Suspense } from "react";
import { WaitlistForm } from "@/components/auth/waitlist-form";

export const metadata: Metadata = { title: "Waitlist" };

export default function WaitlistPage({ searchParams }: PageProps<"/waitlist">) {
  return (
    <div>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Join the waitlist</h1>
      <p className="text-muted-foreground mt-2">
        We&apos;re full for now. Leave your email and we&apos;ll invite you as soon as a spot opens.
      </p>
      <Suspense fallback={<WaitlistForm />}>
        <Prefilled searchParams={searchParams as Promise<{ email?: string }>} />
      </Suspense>
    </div>
  );
}

async function Prefilled({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  return <WaitlistForm email={(await searchParams).email} />;
}
