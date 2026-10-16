import { ArrowRight, Headphones, Info } from "lucide-react";
import { LEVEL_LABELS } from "@/lib/levels";
import { PlayButton } from "./play-button";
import type { SessionView } from "./types";
import { TYPE_LABELS } from "./types";
import { ActionBar, Card, CoachCard, Eyebrow, primaryBtn, Tag } from "./ui";

/** Figma 2:380 — chunk, meaning, when to use it, three examples (FR-011). */
export function LearnStep({
  view,
  onNext,
  busy,
}: {
  view: SessionView;
  onNext: () => void;
  busy: boolean;
}) {
  const { chunk, examples } = view;
  return (
    <div>
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card className="lg:px-10 lg:py-9">
          <div className="flex flex-wrap gap-2">
            <Tag>{TYPE_LABELS[chunk.type]}</Tag>
            <Tag tone="level">
              {chunk.level} · {LEVEL_LABELS[chunk.level]}
            </Tag>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-[clamp(2rem,6vw,3.375rem)] leading-tight">“{chunk.text}”</h2>
            <PlayButton audioRef={`chunk:${chunk.id}`} label="Listen" />
          </div>
          <p className="text-ipa mt-1 text-sm" lang="en-fonipa">
            /{chunk.ipa}/
          </p>
          <div className="mt-8 border-t pt-6">
            <Eyebrow className="text-muted-foreground text-[10px]">What it means</Eyebrow>
            <p className="mt-2 text-lg leading-relaxed">{chunk.meaning}</p>
          </div>
          <div className="bg-surface-subtle mt-5 flex gap-3 rounded-xl p-4">
            <Info aria-hidden className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <div>
              <p className="text-muted-foreground text-[11px] font-bold tracking-[1.3px] uppercase">
                When to use it
              </p>
              <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
                {chunk.usageNote}
              </p>
            </div>
          </div>
        </Card>
        <div className="self-start">
          <CoachCard>
            Listen first, then copy the music of the phrase — not just the words.
          </CoachCard>
        </div>
      </div>

      <section aria-labelledby="examples-title" className="mt-11">
        <Eyebrow>Hear it in real life</Eyebrow>
        <h2 id="examples-title" className="mt-1.5 text-[29px] leading-tight">
          Three ways to use it
        </h2>
        <ul className="mt-5 grid gap-3.5 md:grid-cols-3">
          {examples.map((e) => (
            <li key={e.id} className="bg-card flex flex-col rounded-2xl border p-5">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">0{e.position}</span>
                <Tag>{e.register === "casual" ? "Casual" : "At work"}</Tag>
                <PlayButton
                  audioRef={`example:${e.id}`}
                  label={`Listen to example ${e.position}`}
                  showLabel={false}
                  className="ml-auto"
                />
              </div>
              <p className="mt-6 text-[19px] leading-relaxed">“{e.text}”</p>
            </li>
          ))}
        </ul>
      </section>

      <ActionBar>
        <div className="flex items-center gap-3">
          <Headphones aria-hidden className="size-5" />
          <div>
            <p className="font-bold">Ready to say it?</p>
            <p className="text-muted-foreground text-sm">Next up: two quick speaking tries</p>
          </div>
        </div>
        <button type="button" className={primaryBtn} onClick={onNext} disabled={busy}>
          Start speaking <ArrowRight aria-hidden className="size-4" />
        </button>
      </ActionBar>
    </div>
  );
}
