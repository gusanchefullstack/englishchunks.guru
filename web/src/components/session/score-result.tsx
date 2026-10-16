import { Progress } from "@/components/ui/progress";
import type { Scored } from "./types";
import { scoreLabel } from "./types";

/** Score + Mina's tip + fixed sound hints + component bars (Figma 2:918). */
export function ScoreResult({ result }: { result: Scored }) {
  const label = scoreLabel(result.score);
  return (
    <div role="status" aria-live="polite" className="mt-6 border-t pt-6">
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
              {result.improvement >= 0 ? `+${result.improvement}` : result.improvement} since try 1
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
        <p className="text-sm">
          <span className="font-bold">Mina&apos;s tip: </span>
          {result.tip}
        </p>
      </div>
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
