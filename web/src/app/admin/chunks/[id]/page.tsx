import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChunkForm } from "@/components/admin/chunk-form";
import { adminOrNotFound } from "@/lib/admin-guard";
import { getAdminChunk } from "@/lib/domain/admin-chunks";
import { AppError } from "@/lib/errors";

export const metadata: Metadata = { title: "Edit chunk · Admin" };

export default function ChunkEditPage({ params }: PageProps<"/admin/chunks/[id]">) {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-96 animate-pulse rounded-2xl" />}
    >
      <Edit params={params} />
    </Suspense>
  );
}

async function Edit({ params }: { params: PageProps<"/admin/chunks/[id]">["params"] }) {
  const { id } = await params;
  await adminOrNotFound();
  const empty = {
    id: null,
    text: "",
    type: "idiom",
    level: "B1",
    registers: ["casual"],
    meaning: "",
    usageNote: "",
    status: "active",
    examples: [],
  };
  let initial = empty;
  if (id !== "new") {
    if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
    try {
      const { chunk: c, examples } = await getAdminChunk(id);
      initial = {
        id: c.id,
        text: c.text,
        type: c.type,
        level: c.level,
        registers: c.registers,
        meaning: c.meaning,
        usageNote: c.usageNote,
        status: c.status,
        examples: examples.map((e) => ({ text: e.text, register: e.register })),
      } as typeof empty & { id: string };
    } catch (err) {
      if (err instanceof AppError && err.code === "not_found") notFound();
      throw err;
    }
  }
  return (
    <div>
      <Link href="/admin/chunks" className="text-sm font-bold">
        ← Chunks
      </Link>
      <h1 className="mt-2 mb-6 text-[34px] leading-tight tracking-[-1px]">
        {initial.id ? `Edit “${initial.text}”` : "New chunk"}
      </h1>
      <div className="bg-card rounded-2xl border p-5">
        <ChunkForm initial={initial} />
      </div>
    </div>
  );
}
