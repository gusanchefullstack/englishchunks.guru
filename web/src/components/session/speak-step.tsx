"use client";

import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { PlayButton } from "./play-button";
import { RecordPanel } from "./record-panel";
import { ScoreResult } from "./score-result";
import type { Attempt, AttemptResult, Scored, SessionView } from "./types";
import { SPEAK_ITEMS } from "./types";
import { ActionBar, Card, Eyebrow, ghostBtn, primaryBtn } from "./ui";

/** Figma 2:675 / 2:918 — record the chunk and each example; try 1 then try 2 (FR-013, FR-015). */
export function SpeakStep({
  view,
  step,
  onNext,
  onSkip,
  busy,
}: {
  view: SessionView;
  step: "speak_1" | "speak_2";
  onNext: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const items = SPEAK_ITEMS.map((key, i) =>
    i === 0
      ? { key, text: view.chunk.text, ipa: view.chunk.ipa, ref: `chunk:${view.chunk.id}` }
      : {
          key,
          text: view.examples[i - 1]!.text,
          ipa: view.examples[i - 1]!.ipa,
          ref: `example:${view.examples[i - 1]!.id}`,
        },
  );
  const stored = (key: string) =>
    view.attempts.find((a: Attempt) => a.step === step && a.item === key);
  const [results, setResults] = useState<Record<string, Scored>>({});
  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      items.findIndex((it) => !stored(it.key)),
    ),
  );
  const [micMissing, setMicMissing] = useState(false);
  const current = items[index]!;
  const doneCount = items.filter((it) => results[it.key] || stored(it.key)).length;
  const result = results[current.key];
  const storedScore = stored(current.key)?.score;

  function onResult(r: AttemptResult) {
    if (r.kind === "scored") setResults((prev) => ({ ...prev, [current.key]: r }));
  }

  const isTry2 = step === "speak_2";
  return (
    <div>
      <div className="text-center">
        <Eyebrow>Speak · Try {isTry2 ? 2 : 1}</Eyebrow>
        <h2 className="mt-2 text-[29px]">{isTry2 ? "Say it again." : "Say it your way."}</h2>
        <p className="text-muted-foreground mt-2">
          {isTry2
            ? "Use the tips from try 1 — let's see how much you improve."
            : "Listen once, then record yourself. No pressure—this is your first try."}
        </p>
      </div>

      <Card className="mx-auto mt-7 max-w-[544px] text-center">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="rounded-lg p-2 disabled:opacity-30"
            onClick={() => setIndex(index - 1)}
            disabled={index === 0}
            aria-label="Previous item"
          >
            <ChevronLeft aria-hidden className="size-5" />
          </button>
          <p className="text-muted-foreground text-sm" aria-live="polite">
            {index === 0 ? "The chunk" : `Example ${index}`} · {index + 1} of {items.length}
          </p>
          <button
            type="button"
            className="rounded-lg p-2 disabled:opacity-30"
            onClick={() => setIndex(index + 1)}
            disabled={index === items.length - 1}
            aria-label="Next item"
          >
            <ChevronRight aria-hidden className="size-5" />
          </button>
        </div>
        <div className="mt-4 flex justify-center">
          <PlayButton audioRef={current.ref} label="Hear it first" />
        </div>
        <p className="mt-5 text-[clamp(1.5rem,5vw,2.75rem)] leading-tight">“{current.text}”</p>
        <p className="text-ipa mt-1 text-sm" lang="en-fonipa">
          /{current.ipa}/
        </p>

        {result ? (
          <ScoreResult result={result} />
        ) : storedScore !== undefined ? (
          <p className="mt-6 border-t pt-6">
            Your score: <span className="font-bold">{storedScore}%</span>
          </p>
        ) : null}

        <div className="mt-6">
          <RecordPanel
            key={`${step}-${current.key}`}
            sessionId={view.session.id}
            step={step}
            item={current.key}
            onResult={onResult}
            onMicUnavailable={() => setMicMissing(true)}
          />
        </div>
        <p className="text-muted-foreground mt-2 text-xs">
          Your recording is private and deleted as soon as it&apos;s scored.
        </p>
      </Card>

      <ActionBar>
        <p className="font-bold" aria-live="polite">
          {doneCount}/{items.length} recorded
        </p>
        <div className="flex flex-wrap gap-3">
          {micMissing ? (
            <button type="button" className={ghostBtn} onClick={onSkip} disabled={busy}>
              Skip speaking today
            </button>
          ) : null}
          {result && index < items.length - 1 ? (
            <button type="button" className={ghostBtn} onClick={() => setIndex(index + 1)}>
              Next recording <ArrowRight aria-hidden className="size-4" />
            </button>
          ) : null}
          <button
            type="button"
            className={primaryBtn}
            onClick={onNext}
            disabled={busy || doneCount < items.length}
          >
            {isTry2 ? "Continue to writing" : "Continue to try 2"}{" "}
            <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </ActionBar>
    </div>
  );
}
