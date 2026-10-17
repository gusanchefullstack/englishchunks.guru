"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cefrLevels } from "@/db/schema/enums";
import { adminDeleteUser, adminSuspendUser, adminUpdateUser } from "@/server/actions/admin";

const field = "bg-card h-10 rounded-lg border px-3 text-sm";

export function UserActions({
  id,
  level,
  banned,
  isSelf,
}: {
  id: string;
  level: string | null;
  banned: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState("");
  async function run(p: Promise<{ ok: boolean; error?: { message: string } }>, done: string) {
    setBusy(true);
    const r = await p;
    setBusy(false);
    if (!r.ok) return toast.error(r.error?.message ?? "Failed");
    toast.success(done);
    router.refresh();
  }
  return (
    <div className="grid gap-5">
      <label className="flex flex-wrap items-center gap-3 text-sm font-bold">
        English level
        <select
          aria-label="English level"
          defaultValue={level ?? ""}
          className={field}
          onChange={(e) => run(adminUpdateUser(id, { level: e.target.value }), "Level updated")}
          disabled={busy}
        >
          {cefrLevels.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      {isSelf ? (
        <p className="text-muted-foreground text-sm">
          This is your account — manage it from your profile.
        </p>
      ) : (
        <>
          <div>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                run(
                  adminSuspendUser(id, !banned, "Suspended by an admin"),
                  banned ? "User reinstated" : "User suspended",
                )
              }
              className="border-destructive text-destructive h-10 rounded-lg border px-4 text-sm font-bold"
            >
              {banned ? "Reinstate user" : "Suspend user"}
            </button>
          </div>
          <div className="border-destructive/40 flex flex-wrap items-end gap-3 rounded-xl border p-4">
            <label className="grid gap-1 text-xs font-bold">
              Type DELETE to erase this account
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className={field}
                autoComplete="off"
              />
            </label>
            <button
              type="button"
              disabled={busy || confirm !== "DELETE"}
              onClick={async () => {
                const r = await adminDeleteUser(id, confirm);
                if (!r.ok) return toast.error(r.error.message);
                toast.success("User deleted");
                router.push("/admin/users");
              }}
              className="bg-destructive h-10 rounded-lg px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              Delete user
            </button>
          </div>
        </>
      )}
    </div>
  );
}
