"use client";

import { ArrowRight, Check, Loader2, Sparkles, X } from "lucide-react";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { submitWriting } from "@/server/actions/session";
import type { SessionView, Writing } from "./types";
import { ActionBar, Card, Eyebrow, primaryBtn } from "./ui";

/** Figma 2:1330 / 2:1531 — three own sentences, graded and corrected (FR-016). */
export function WriteStep({
  view,
  onNext,
  busy,
}: {
  view: SessionView;
  onNext: () => void;
  busy: boolean;
}) {
  const [sentences, setSentences] = useState<string[]>(() =>
    view.writing.length === 3
      ? view.writing.map((w) => (w.original === "[removed]" ? "" : w.original))
      : ["", "", ""],
  );
  const [feedback, setFeedback] = useState<Writing[]>(view.writing);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const correctCount = feedback.filter((f) => f.usesChunk).length;

  async function check() {
    setChecking(true);
    setError("");
    const res = await submitWriting(view.session.id, sentences);
    setChecking(false);
    if (res.ok) setFeedback(res.data);
    else setError(res.error.message);
  }

  const chunkText = view.chunk.text;
  return (
    <div>
      <div className="text-center">
        <Eyebrow>Make it yours</Eyebrow>
        <h2 className="mt-2 text-[29px]">Write three sentences.</h2>
        <p className="text-muted-foreground mt-2">
          Use <strong className="text-foreground">“{chunkText}”</strong> in situations from your own
          life.
        </p>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_200px]">
        <Card className="grid gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-start gap-3">
              <span
                aria-hidden
                className="bg-muted mt-3 grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold"
              >
                {i + 1}
              </span>
              <label className="sr-only" htmlFor={`sentence-${i}`}>
                Sentence {i + 1}
              </label>
              <Textarea
                id={`sentence-${i}`}
                value={sentences[i]}
                maxLength={300}
                rows={2}
                placeholder="Write your sentence here…"
                onChange={(e) =>
                  setSentences((prev) => prev.map((s, j) => (j === i ? e.target.value : s)))
                }
              />
              {feedback[i] ? (
                feedback[i]!.usesChunk ? (
                  <Check
                    aria-label="Uses the chunk"
                    className="text-nav-active-foreground mt-3 size-5 shrink-0"
                  />
                ) : (
                  <X
                    aria-label="Doesn't use the chunk yet"
                    className="text-destructive mt-3 size-5 shrink-0"
                  />
                )
              ) : null}
            </div>
          ))}
          <div className="flex items-center gap-3">
            <button
              type="button"
              className={primaryBtn}
              onClick={check}
              disabled={checking || sentences.some((s) => !s.trim())}
            >
              {checking ? <Loader2 aria-hidden className="size-4 animate-spin" /> : null}
              Check my sentences
            </button>
            <p role="status" aria-live="polite" className="text-destructive text-sm">
              {error}
            </p>
          </div>
        </Card>
        <aside className="bg-accent/30 self-start rounded-2xl border p-5 text-sm">
          <Sparkles aria-hidden className="text-lavender size-4" />
          <p className="mt-2 font-bold">A little inspiration</p>
          <p className="mt-1">{view.chunk.usageNote}</p>
          <p className="bg-card mt-3 rounded-lg p-3">“{view.examples[0]?.text}”</p>
        </aside>
      </div>

      {feedback.length === 3 ? (
        <section
          aria-labelledby="feedback-title"
          className="bg-card mt-6 overflow-hidden rounded-2xl border"
        >
          <div className="bg-streak flex items-center justify-between gap-3 px-6 py-5">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-full font-bold"
              >
                M
              </span>
              <div>
                <p className="text-eyebrow text-[10px] font-bold tracking-[1.3px] uppercase">
                  Mina&apos;s feedback
                </p>
                <p id="feedback-title">
                  {correctCount === 3
                    ? "All three use the chunk correctly!"
                    : `${correctCount} of 3 use the chunk — check the notes below.`}
                </p>
              </div>
            </div>
            <p className="text-2xl font-bold">{correctCount}/3</p>
          </div>
          <ol className="divide-y">
            {feedback.map((f) => (
              <li key={f.position} className="grid gap-3 px-6 py-5 md:grid-cols-[1fr_220px]">
                <div>
                  <p className="text-muted-foreground text-[10px] font-bold tracking-[1.3px] uppercase">
                    Your sentence
                  </p>
                  <p className="mt-1">{f.original}</p>
                  <p className="text-muted-foreground mt-3 text-[10px] font-bold tracking-[1.3px] uppercase">
                    Polished version
                  </p>
                  <p className="mt-1">{f.corrected}</p>
                </div>
                <p className="bg-surface-subtle text-muted-foreground self-start rounded-lg p-3 text-sm">
                  {f.explanation}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <ActionBar>
        <span />
        <button
          type="button"
          className={primaryBtn}
          onClick={onNext}
          disabled={busy || feedback.length < 3}
        >
          Practice reading aloud <ArrowRight aria-hidden className="size-4" />
        </button>
      </ActionBar>
    </div>
  );
}
