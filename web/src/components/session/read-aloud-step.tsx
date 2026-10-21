"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { PlayButton } from "./play-button";
import { RecordPanel } from "./record-panel";
import type { SessionView } from "./types";
import { READ_ITEMS } from "./types";
import { ActionBar, Card, Eyebrow, ghostBtn, primaryBtn } from "./ui";

/** Figma 2:1781 / 2:2022 — hear each corrected sentence, then read it aloud (FR-017). */
export function ReadAloudStep({
  view,
  onFinish,
  onSkip,
  busy,
}: {
  view: SessionView;
  onFinish: () => void;
  onSkip: () => void;
  busy: boolean;
}) {
  const initial = Object.fromEntries(
    view.attempts.filter((a) => a.step === "read_aloud").map((a) => [a.item, a.score]),
  ) as Record<string, number>;
  const [scores, setScores] = useState<Record<string, number>>(initial);
  const [micMissing, setMicMissing] = useState(false);
  const done = READ_ITEMS.filter((k) => scores[k] !== undefined).length;

  return (
    <div>
      <div className="text-center">
        <Eyebrow>Read aloud</Eyebrow>
        <h2 className="mt-2 text-[29px]">Now say your sentences.</h2>
        <p className="text-muted-foreground mt-2">
          Listen to the polished version, then record yourself reading it.
        </p>
      </div>
      <ol aria-label="Sentences to read aloud" className="mx-auto mt-7 grid max-w-[720px] gap-4">
        {view.writing.map((w, i) => {
          const key = READ_ITEMS[i]!;
          const removed = w.corrected === "[removed]";
          return (
            <li key={w.id}>
              <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <span
                  aria-hidden
                  className="bg-muted grid size-8 shrink-0 place-items-center rounded-full font-bold"
                >
                  {i + 1}
                </span>
                <p className="flex-1 text-lg">
                  {removed ? "This sentence can't be read aloud." : w.corrected}
                </p>
                {removed ? null : (
                  <div className="flex flex-wrap items-center gap-3">
                    <PlayButton audioRef={`sentence:${w.id}`} label="Hear sentence" />
                    {scores[key] !== undefined ? (
                      <span className="bg-tag-level text-tag-level-foreground rounded-full px-3 py-1 text-sm font-bold">
                        {scores[key]}%
                      </span>
                    ) : null}
                    <RecordPanel
                      sessionId={view.session.id}
                      step="read_aloud"
                      item={key}
                      compact
                      onMicUnavailable={() => setMicMissing(true)}
                      onLimitReached={() => setMicMissing(true)}
                      onResult={(r) =>
                        r.kind === "scored" && setScores((s) => ({ ...s, [key]: r.score }))
                      }
                    />
                  </div>
                )}
              </Card>
            </li>
          );
        })}
      </ol>
      <ActionBar>
        <div>
          <p className="font-bold" aria-live="polite">
            {done}/3 {done === 3 ? "· Lovely work!" : "· One sentence at a time"}
          </p>
          <p className="text-muted-foreground text-sm">
            {done === 3 ? "You're ready to see today's score." : "Listen, record, and keep going."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {micMissing ? (
            <button type="button" className={ghostBtn} onClick={onSkip} disabled={busy}>
              Skip and finish
            </button>
          ) : null}
          <button
            type="button"
            className={primaryBtn}
            onClick={onFinish}
            disabled={busy || done < 3}
          >
            See daily score <ArrowRight aria-hidden className="size-4" />
          </button>
        </div>
      </ActionBar>
    </div>
  );
}
