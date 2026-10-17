"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

async function go(path: string, body?: unknown) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.url)
    throw new Error(json?.error?.message ?? "Billing is unavailable right now.");
  window.location.assign(json.url); // Stripe-hosted page: card details never touch our servers
}

export function SubscribeButton({
  tier,
  label,
}: {
  tier: "basic" | "standard" | "premium";
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await go("/api/billing/checkout", { tier }).catch((e: Error) => {
          setBusy(false);
          toast.error(e.message);
        });
      }}
      className="bg-primary text-primary-foreground inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-4 font-bold disabled:opacity-50"
    >
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

export function ManageButton() {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await go("/api/billing/portal").catch((e: Error) => {
          setBusy(false);
          toast.error(e.message);
        });
      }}
      className="bg-card inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 font-bold disabled:opacity-50"
    >
      {busy ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
      Manage plan &amp; payment
    </button>
  );
}
