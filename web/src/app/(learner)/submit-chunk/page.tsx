import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SubmitChunkForm } from "@/components/submissions/submit-form";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Suggest a chunk" };

export default function SubmitChunkPage() {
  return (
    <div className="mx-auto max-w-xl">
      <p className="text-eyebrow text-xs font-bold tracking-[1.7px] uppercase">Grow the library</p>
      <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">Suggest a chunk</h1>
      <p className="text-muted-foreground mt-1">
        Heard a useful phrase? Suggest it. If an admin adds it, you earn 20 points.{" "}
        <Link href="/my-submissions">My suggestions</Link>
      </p>
      <div className="bg-card mt-6 rounded-[20px] border p-6">
        <Suspense
          fallback={<div aria-busy="true" className="bg-muted h-64 animate-pulse rounded-xl" />}
        >
          <Guarded />
        </Suspense>
      </div>
    </div>
  );
}

async function Guarded() {
  await learnerOrRedirect();
  return <SubmitChunkForm />;
}
