"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { authClient, browserTimeZone } from "@/lib/auth-client";
import { Divider, Field, GoogleMark, outlineBtn, submitBtn } from "./fields";

export function SignUpForm({ invite, invitedEmail }: { invite?: string; invitedEmail?: string }) {
  const router = useRouter();
  const [ageConfirmed, setAge] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email")).trim().toLowerCase();
    setPending(true);
    setError("");
    const { error: err } = await authClient.signUp.email({
      name: String(f.get("name")).trim(),
      username: String(f.get("username")).trim().toLowerCase(),
      email,
      password: String(f.get("password")),
      callbackURL: "/onboarding/level",
      ageConfirmed,
      timeZone: browserTimeZone(),
      ...(invite ? { inviteToken: invite } : {}),
    } as Parameters<typeof authClient.signUp.email>[0]);
    setPending(false);
    if (err) {
      if (err.code === "SIGNUP_CLOSED")
        return router.push(`/waitlist?email=${encodeURIComponent(email)}`);
      return setError(err.message ?? "We couldn't create your account. Please try again.");
    }
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  async function google() {
    setError("");
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/onboarding/level",
    });
    if (err) setError(err.message ?? "Google sign-in isn't available right now.");
  }

  return (
    <div>
      <p className="text-brand-link text-xs font-bold tracking-[1.3px] uppercase">Start free</p>
      <h1 className="mt-3 text-[34px] leading-tight tracking-[-1px]">Start speaking with ease.</h1>
      <p className="text-muted-foreground mt-2">
        Create your account. Your first chunk is waiting.
      </p>

      <div className="mt-7 grid gap-5">
        <label className="bg-surface-subtle flex items-start gap-3 rounded-xl p-3 text-sm">
          <Checkbox
            checked={ageConfirmed}
            onCheckedChange={(v) => setAge(v === true)}
            aria-describedby="age-hint"
            className="mt-0.5"
          />
          <span>
            I am 16 or older
            <span id="age-hint" className="text-muted-foreground block text-xs">
              EnglishChunks.guru is for learners aged 16 and over.
            </span>
          </span>
        </label>
        <button type="button" className={outlineBtn} onClick={google} disabled={!ageConfirmed}>
          <GoogleMark /> Continue with Google
        </button>
        <Divider>or continue with email</Divider>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate={false}>
          <Field
            label="Your name"
            id="name"
            placeholder="e.g. Amira"
            required
            maxLength={40}
            autoComplete="name"
          />
          <Field
            label="Username"
            id="username"
            placeholder="e.g. amira_m"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-z0-9_]{3,24}"
            hint="3–24 lowercase letters, numbers or _"
            autoComplete="username"
          />
          <Field
            label="Email address"
            id="email"
            type="email"
            placeholder="you@example.com"
            required
            autoComplete="email"
            defaultValue={invitedEmail}
            readOnly={Boolean(invite && invitedEmail)}
          />
          <Field
            label="Password"
            id="password"
            type="password"
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <p role="alert" aria-live="assertive" className="text-destructive text-sm">
            {error}
          </p>
          <button type="submit" className={submitBtn} disabled={pending || !ageConfirmed}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Create my free account <ArrowRight aria-hidden className="size-4" />
          </button>
        </form>
        <p className="text-muted-foreground text-center text-xs">
          By creating an account you agree to our <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy policy</Link>.
        </p>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account? <Link href="/sign-in">Log in</Link>
        </p>
      </div>
    </div>
  );
}
