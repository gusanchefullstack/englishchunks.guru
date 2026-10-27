import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import type { Scored } from "./types";
import { scoreLabel } from "./types";

/**
 * Score + Mina's tip + fixed sound hints + component bars (Figma 2:918).
 * `children` (the record button) sits right under the tip, so retrying doesn't
 * push the phrase off-screen on phones.
 */
export function ScoreResult({ result, children }: { result: Scored; children?: ReactNode }) {
  const label = scoreLabel(result.score);
  return (
    <div className="mt-6 border-t pt-6">
      <div role="status" aria-live="polite">
        <div className="flex items-center justify-center gap-6">
          <p className="text-4xl font-bold">
            {result.score}
            <span className="text-muted-foreground text-base">%</span>
          </p>
          <div>
            <p className="text-eyebrow text-xs font-bold">{label.title}</p>
            <p>{label.line}</p>
            {result.improvement !== null ? (
              <p className="text-nav-active-foreground text-sm font-bold">
                {result.improvement >= 0 ? `+${result.improvement}` : result.improvement} since try
                1
              </p>
            ) : null}
          </div>
        </div>
        <div className="bg-streak mt-5 flex gap-3 rounded-xl p-4">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground grid size-8 shrink-0 place-items-center rounded-full font-bold"
          >
            M
          </span>
          <p className="text-sm" aria-busy={result.tip === null}>
            <span className="font-bold">Mina&apos;s tip: </span>
            {result.tip ?? (
              <span className="text-muted-foreground inline-flex items-center gap-1.5">
                <Loader2 aria-hidden className="size-3.5 animate-spin" />
                Mina is writing a tip…
              </span>
            )}
          </p>
        </div>
      </div>
      {children}
      {result.weakestSounds.length ? (
        <ul className="mt-4 grid gap-2" aria-label="Sounds to practice">
          {result.weakestSounds.map((h) => (
            <li key={h.ipa} className="bg-surface-subtle rounded-lg px-4 py-3 text-sm">
              <span className="font-bold">The sound in “{h.exampleWords.join("”, “")}”: </span>
              {h.hint}
            </li>
          ))}
        </ul>
      ) : null}
      <dl className="mt-5 grid gap-2 text-sm">
        {(
          [
            ["Sounds", result.components.sounds],
            ["Words", result.components.words],
            ["Flow", result.components.flow],
          ] as const
        ).map(([name, value]) => (
          <div key={name} className="grid grid-cols-[64px_1fr_32px] items-center gap-3">
            <dt>{name}</dt>
            <dd className="contents">
              <Progress value={value} aria-label={`${name} ${value} out of 100`} />
              <span className="text-right font-bold">{value}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
