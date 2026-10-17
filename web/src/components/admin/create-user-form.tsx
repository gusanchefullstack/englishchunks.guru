"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cefrLevels } from "@/db/schema/enums";
import { adminCreateUser } from "@/server/actions/admin";

const field = "bg-card h-10 w-full rounded-lg border px-3 text-sm";

export function CreateUserForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form));
    setBusy(true);
    const r = await adminCreateUser(f);
    setBusy(false);
    if (!r.ok) return toast.error(r.error.message);
    toast.success("User created");
    form.reset();
    router.refresh();
  }
  return (
    <form onSubmit={onSubmit} className="mt-4 grid gap-3 md:grid-cols-3">
      <label className="grid gap-1 text-xs font-bold">
        Display name
        <input name="name" required maxLength={40} className={field} />
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Username
        <input name="username" required pattern="[a-z0-9_]{3,24}" className={field} />
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Email
        <input name="email" type="email" required className={field} />
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Temporary password
        <input
          name="password"
          type="password"
          minLength={8}
          required
          className={field}
          autoComplete="new-password"
        />
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Level
        <select name="level" className={field} defaultValue="B1">
          {cefrLevels.map((l) => (
            <option key={l}>{l}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1 text-xs font-bold">
        Role
        <select name="role" className={field} defaultValue="learner">
          <option value="learner">learner</option>
          <option value="admin">admin</option>
        </select>
      </label>
      <div>
        <button
          type="submit"
          disabled={busy}
          className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold"
        >
          Create user
        </button>
      </div>
    </form>
  );
}
