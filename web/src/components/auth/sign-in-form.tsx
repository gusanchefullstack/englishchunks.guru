"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Divider, Field, GoogleMark, outlineBtn, submitBtn } from "./fields";

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [unverifiedEmail, setUnverified] = useState("");
  const reset = params.get("reset") === "1";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    setPending(true);
    setError("");
    setUnverified("");
    const { error: err } = await authClient.signIn.email({
      email,
      password: String(f.get("password")),
    });
    setPending(false);
    if (err) {
      if (err.status === 403) return setUnverified(email);
      return setError("That email and password don't match. Please try again.");
    }
    router.push("/today");
    router.refresh();
  }

  return (
    <div>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Welcome back.</h1>
      <p className="text-muted-foreground mt-2">Your next chunk is ready for you.</p>
      {reset ? (
        <p
          role="status"
          className="bg-tag-level text-tag-level-foreground mt-5 rounded-xl p-3 text-sm"
        >
          Your password was changed. Log in with your new password.
        </p>
      ) : null}
      <div className="mt-7 grid gap-5">
        <button
          type="button"
          className={outlineBtn}
          onClick={async () => {
            const { error: err } = await authClient.signIn.social({
              provider: "google",
              callbackURL: "/today",
            });
            if (err) setError(err.message ?? "Google sign-in isn't available right now.");
          }}
        >
          <GoogleMark /> Continue with Google
        </button>
        <Divider>or continue with email</Divider>
        <form onSubmit={onSubmit} className="grid gap-4">
          <Field
            label="Email address"
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
          />
          <Field
            label="Password"
            id="password"
            type="password"
            placeholder="At least 8 characters"
            required
            autoComplete="current-password"
          />
          <p className="-mt-1 text-right text-sm">
            <Link href="/forgot-password">Forgot your password?</Link>
          </p>
          <div role="alert" aria-live="assertive" className="text-sm">
            {error ? <p className="text-destructive">{error}</p> : null}
            {unverifiedEmail ? (
              <p>
                Please confirm your email first.{" "}
                <Link href={`/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}>
                  Resend the link
                </Link>
              </p>
            ) : null}
          </div>
          <button type="submit" className={submitBtn} disabled={pending}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Log in
          </button>
        </form>
        <p className="text-muted-foreground text-center text-sm">
          New here? <Link href="/sign-up">Start free</Link>
        </p>
      </div>
    </div>
  );
}
