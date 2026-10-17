"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { adminInviteFromWaitlist, adminSetAccountCap } from "@/server/actions/admin-settings";

type Entry = {
  id: string;
  email: string;
  status: string;
  inviteExpiresAt: Date | null;
  createdAt: Date;
};

export function WaitlistManager({
  entries,
  cap,
  count,
  billingActive,
}: {
  entries: Entry[];
  cap: number;
  count: number;
  billingActive: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const waiting = entries.filter((e) => e.status === "waiting" || e.status === "expired");

  async function invite() {
    setBusy(true);
    const r = await adminInviteFromWaitlist(selected);
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success(`Invited ${r.data}`);
    setSelected([]);
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <form
        className="bg-card flex flex-wrap items-end gap-3 rounded-2xl border p-5"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await adminSetAccountCap(Number(new FormData(e.currentTarget).get("cap")));
          if (!r.ok) return toast.error(r.error.message);
          toast.success("Account cap saved");
          router.refresh();
        }}
      >
        <label className="grid gap-1 text-xs font-bold">
          Account cap (while billing is off)
          <input
            name="cap"
            type="number"
            min={0}
            defaultValue={cap}
            className="bg-card h-10 w-40 rounded-lg border px-3 text-sm"
          />
        </label>
        <button type="submit" className="h-10 rounded-lg border px-4 text-sm font-bold">
          Save cap
        </button>
        <p className="text-muted-foreground text-sm">
          {count} of {cap} learner accounts used
          {billingActive ? " · billing is active, so sign-up is open to everyone" : ""}.
        </p>
      </form>

      <section aria-labelledby="wl-title" className="bg-card rounded-2xl border p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="wl-title" className="text-xl">
            Waitlist ({waiting.length} waiting)
          </h2>
          <button
            type="button"
            disabled={!selected.length || busy}
            onClick={invite}
            className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold disabled:opacity-50"
          >
            Invite selected ({selected.length})
          </button>
        </div>
        <table className="mt-4 w-full text-left text-sm">
          <caption className="sr-only">Waitlist entries</caption>
          <thead className="text-muted-foreground">
            <tr>
              <th scope="col" className="w-10 py-2">
                <span className="sr-only">Select</span>
              </th>
              <th scope="col" className="py-2 font-normal">
                Email
              </th>
              <th scope="col" className="py-2 font-normal">
                Status
              </th>
              <th scope="col" className="py-2 font-normal">
                Joined
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="py-2">
                  {e.status === "waiting" || e.status === "expired" ? (
                    <input
                      type="checkbox"
                      aria-label={`Select ${e.email}`}
                      checked={selected.includes(e.id)}
                      onChange={(ev) =>
                        setSelected((s) =>
                          ev.target.checked ? [...s, e.id] : s.filter((x) => x !== e.id),
                        )
                      }
                      className="size-4"
                    />
                  ) : null}
                </td>
                <td className="py-2">{e.email}</td>
                <td className="py-2">
                  {e.status}
                  {e.status === "invited" && e.inviteExpiresAt
                    ? ` · expires ${new Date(e.inviteExpiresAt).toLocaleDateString("en-US")}`
                    : ""}
                </td>
                <td className="py-2">{new Date(e.createdAt).toLocaleDateString("en-US")}</td>
              </tr>
            ))}
            {!entries.length ? (
              <tr className="border-t">
                <td colSpan={4} className="text-muted-foreground py-3">
                  Nobody on the waitlist yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
