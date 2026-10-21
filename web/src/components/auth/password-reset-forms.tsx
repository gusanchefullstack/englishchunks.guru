"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useActionState, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { requestPasswordReset } from "@/server/actions/auth";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/account-rules";
import { Field, PASSWORD_ERRORS, PasswordHint, submitBtn } from "./fields";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  return (
    <div>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Forgot your password?</h1>
      <p className="text-muted-foreground mt-2">
        We&apos;ll email you a link to choose a new one. It works once and expires in 1 hour.
      </p>
      {state?.sent ? (
        <p role="status" className="bg-tag-level text-tag-level-foreground mt-6 rounded-xl p-4">
          If an account exists for that email, the link is on its way.
        </p>
      ) : (
        <form action={action} className="mt-7 grid gap-4">
          <Field label="Email address" id="email" type="email" required autoComplete="email" />
          <button type="submit" className={submitBtn} disabled={pending}>
            {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
            Send the link
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/sign-in">Back to log in</Link>
      </p>
    </div>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const invalid = params.get("error") === "INVALID_TOKEN" || !token;
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [passwordLength, setPasswordLength] = useState(0);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const newPassword = String(f.get("password"));
    if (newPassword !== String(f.get("confirm"))) return setError("The passwords don't match.");
    setPending(true);
    const { error: err } = await authClient.resetPassword({ newPassword, token });
    setPending(false);
    if (err)
      return setError(
        (err.code && PASSWORD_ERRORS[err.code]) ??
          "This link has expired or was already used. Please request a new one.",
      );
    router.push("/sign-in?reset=1");
  }
  if (invalid) {
    return (
      <div>
        <h1 className="text-[34px] leading-tight tracking-[-1px]">This link has expired</h1>
        <p className="text-muted-foreground mt-2">Reset links work once and expire after 1 hour.</p>
        <p className="mt-6">
          <Link href="/forgot-password">Request a new link</Link>
        </p>
      </div>
    );
  }
  return (
    <div>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-7 grid gap-4">
        <Field
          label="New password"
          id="password"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          onChange={(e) => setPasswordLength(e.currentTarget.value.length)}
          hint={<PasswordHint length={passwordLength} />}
          autoComplete="new-password"
        />
        <Field
          label="Repeat the new password"
          id="confirm"
          type="password"
          required
          minLength={PASSWORD_MIN}
          maxLength={PASSWORD_MAX}
          autoComplete="new-password"
        />
        <p role="alert" aria-live="assertive" className="text-destructive text-sm">
          {error}
        </p>
        <button type="submit" className={submitBtn} disabled={pending}>
          {pending ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
          Save my new password
        </button>
      </form>
    </div>
  );
}
