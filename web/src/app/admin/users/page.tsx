import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CreateUserForm } from "@/components/admin/create-user-form";
import { cefrLevels, planTiers } from "@/db/schema/enums";
import { adminOrNotFound } from "@/lib/admin-guard";
import { listUsers } from "@/lib/domain/admin-users";

export const metadata: Metadata = { title: "Users · Admin" };
type Search = { q?: string; plan?: string; status?: string; level?: string; page?: string };
const control = "bg-card h-10 rounded-lg border px-3 text-sm";
const fmt = (d: Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <>
      <h1 className="text-[34px] leading-tight tracking-[-1px]">Users</h1>
      <Suspense
        fallback={<div aria-busy="true" className="bg-muted mt-6 h-96 animate-pulse rounded-2xl" />}
      >
        <Users searchParams={searchParams as Promise<Search>} />
      </Suspense>
    </>
  );
}

async function Users({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  await adminOrNotFound();
  const r = await listUsers(sp);
  return (
    <>
      <form method="get" role="search" className="mt-6 flex flex-wrap gap-2">
        <label>
          <span className="sr-only">Search users</span>
          <input
            name="q"
            defaultValue={r.filter.q ?? ""}
            placeholder="Name, username or email"
            className={`${control} w-64`}
          />
        </label>
        <label>
          <span className="sr-only">Plan</span>
          <select name="plan" defaultValue={r.filter.plan ?? ""} className={control}>
            <option value="">All plans</option>
            {planTiers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Status</span>
          <select name="status" defaultValue={r.filter.status ?? ""} className={control}>
            <option value="">All statuses</option>
            <option value="active">active</option>
            <option value="unverified">unverified</option>
            <option value="suspended">suspended</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Level</span>
          <select name="level" defaultValue={r.filter.level ?? ""} className={control}>
            <option value="">All levels</option>
            {cefrLevels.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-10 rounded-lg px-4 text-sm font-bold"
        >
          Filter
        </button>
      </form>
      <p role="status" className="mt-4 text-sm font-bold">
        {r.total} user{r.total === 1 ? "" : "s"}
      </p>
      <div className="bg-card mt-2 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-[900px] text-left text-sm">
          <caption className="sr-only">Users</caption>
          <thead className="text-muted-foreground">
            <tr>
              {[
                "Username",
                "Email",
                "Level",
                "Plan",
                "Subscription",
                "Renews",
                "Signed up",
                "Last active",
              ].map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="px-4 py-3">
                  <Link href={`/admin/users/${u.id}`} className="font-bold">
                    {u.username ?? u.name}
                  </Link>
                  {u.banned ? (
                    <span className="text-destructive ml-2 text-xs font-bold">suspended</span>
                  ) : !u.emailVerified ? (
                    <span className="text-muted-foreground ml-2 text-xs">unverified</span>
                  ) : null}
                  {u.role === "admin" ? (
                    <span className="bg-tag-type text-tag-type-foreground ml-2 rounded px-1.5 text-[10px] font-bold">
                      ADMIN
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3">{u.email}</td>
                <td className="px-4 py-3">{u.level ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{u.tier}</td>
                <td className="px-4 py-3">{u.subStatus.replace("_", " ")}</td>
                <td className="px-4 py-3">{fmt(u.renewsAt)}</td>
                <td className="px-4 py-3">{fmt(u.createdAt)}</td>
                <td className="px-4 py-3">{fmt(u.lastActiveAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby="create-title" className="bg-card mt-8 rounded-2xl border p-5">
        <h2 id="create-title" className="text-xl">
          Create a user
        </h2>
        <CreateUserForm />
      </section>
    </>
  );
}
