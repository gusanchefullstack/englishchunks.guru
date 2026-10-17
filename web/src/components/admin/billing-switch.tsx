"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { adminSetBilling } from "@/server/actions/admin-settings";

export function BillingSwitch({ active }: { active: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState("");
  const word = active ? "DEACTIVATE" : "ACTIVATE";
  return (
    <div className="grid gap-3">
      <p>
        Paid billing is <strong>{active ? "ACTIVE" : "OFF"}</strong>.{" "}
        {active
          ? "New learners get a 7-day trial; early testers keep free Basic."
          : "Everyone is on free Basic and no payments can happen."}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-xs font-bold">
          Type {word} to confirm
          <input
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="off"
            className="bg-card h-10 rounded-lg border px-3 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={confirm !== word}
          onClick={async () => {
            const r = await adminSetBilling(!active, confirm);
            if (!r.ok) return toast.error(r.error.message);
            toast.success(r.data ? "Billing activated" : "Billing turned off");
            setConfirm("");
            router.refresh();
          }}
          className={`${active ? "border-destructive text-destructive border" : "bg-primary text-primary-foreground"} h-10 rounded-lg px-4 text-sm font-bold disabled:opacity-50`}
        >
          {active ? "Turn billing off" : "Activate paid billing"}
        </button>
      </div>
    </div>
  );
}
