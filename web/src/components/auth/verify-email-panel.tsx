"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { outlineBtn } from "./fields";

export function VerifyEmailPanel() {
  const email = useSearchParams().get("email") ?? "";
  const [status, setStatus] = useState("");
  async function resend() {
    setStatus("");
    const { error } = await authClient.sendVerificationEmail({
      email,
      callbackURL: "/onboarding/level",
    });
    setStatus(
      error
        ? "We couldn't send the email. Please try again in a minute."
        : "We sent a new link. Check your inbox.",
    );
  }
  return (
    <div className="text-center">
      <span className="bg-nav-active mx-auto grid size-14 place-items-center rounded-2xl">
        <MailCheck aria-hidden className="size-6" />
      </span>
      <h1 className="mt-5 text-[34px] leading-tight tracking-[-1px]">Check your inbox</h1>
      <p className="text-muted-foreground mt-3">
        We sent a confirmation link
        {email ? (
          <>
            {" "}
            to <strong className="text-foreground">{email}</strong>
          </>
        ) : null}
        . Open it to start your first chunk.
      </p>
      <div className="mt-7 grid gap-3">
        {email ? (
          <button type="button" className={outlineBtn} onClick={resend}>
            Resend the link
          </button>
        ) : null}
        <p role="status" aria-live="polite" className="text-sm">
          {status}
        </p>
        <Link href="/sign-in" className="text-sm">
          Back to log in
        </Link>
      </div>
    </div>
  );
}
