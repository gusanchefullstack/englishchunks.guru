import { ArrowLeft, Info } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PracticeChunkButton } from "@/components/library/practice-button";
import { PlayButton } from "@/components/session/play-button";
import { TYPE_LABELS } from "@/components/session/types";
import { Card, Eyebrow, Tag } from "@/components/session/ui";
import { getLibraryChunk } from "@/lib/domain/library";
import { getTodayStatus } from "@/lib/domain/session-engine";
import { AppError } from "@/lib/errors";
import { LEVEL_LABELS } from "@/lib/levels";
import { learnerOrRedirect } from "@/lib/page-guards";

export const metadata: Metadata = { title: "Chunk" };

export default function ChunkPage({ params }: PageProps<"/library/[chunkId]">) {
  return (
    <Suspense
      fallback={<div aria-busy="true" className="bg-muted h-96 animate-pulse rounded-[20px]" />}
    >
      <ChunkContent params={params} />
    </Suspense>
  );
}

async function ChunkContent({ params }: { params: PageProps<"/library/[chunkId]">["params"] }) {
  const { chunkId } = await params;
  const learner = await learnerOrRedirect();
  let data;
  try {
    data = await getLibraryChunk(chunkId);
  } catch (err) {
    if (err instanceof AppError && err.code === "not_found") notFound();
    throw err;
  }
  const status = await getTodayStatus({
    userId: learner.id,
    level: learner.level,
    timeZone: learner.timeZone,
  });
  const { chunk, examples } = data;
  return (
    <div>
      <Link href="/library" className="inline-flex items-center gap-1 text-sm font-bold">
        <ArrowLeft aria-hidden className="size-4" /> Chunk library
      </Link>
      <Card className="mt-5 lg:px-10">
        <div className="flex flex-wrap gap-2">
          <Tag>{TYPE_LABELS[chunk.type]}</Tag>
          <Tag tone="level">
            {chunk.level} · {LEVEL_LABELS[chunk.level]}
          </Tag>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-[clamp(2rem,6vw,3.375rem)] leading-tight">“{chunk.text}”</h1>
          <PlayButton audioRef={`chunk:${chunk.id}`} label="Listen" />
        </div>
        <p className="text-ipa mt-1 text-sm" lang="en-fonipa">
          /{chunk.ipa}/
        </p>
        <div className="mt-8 border-t pt-6">
          <Eyebrow className="text-muted-foreground text-[10px]">What it means</Eyebrow>
          <p className="mt-2 text-lg">{chunk.meaning}</p>
        </div>
        <div className="bg-surface-subtle mt-5 flex gap-3 rounded-xl p-4">
          <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
          <p className="text-muted-foreground text-sm">{chunk.usageNote}</p>
        </div>
        <ul className="mt-6 grid gap-3">
          {examples.map((e) => (
            <li key={e.id} className="flex items-center gap-3">
              <PlayButton
                audioRef={`example:${e.id}`}
                label={`Listen to example ${e.position}`}
                showLabel={false}
                size="sm"
              />
              <span>“{e.text}”</span>
            </li>
          ))}
        </ul>
        <div className="mt-8 border-t pt-6">
          <PracticeChunkButton chunkId={chunk.id} remaining={status.remaining} />
        </div>
      </Card>
    </div>
  );
}
