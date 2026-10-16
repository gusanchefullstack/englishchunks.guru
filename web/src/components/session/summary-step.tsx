import { Flame, PenLine, Star, TrendingUp, Volume2 } from "lucide-react";
import Link from "next/link";
import type { SessionView } from "./types";
import { Card, Eyebrow, ghostBtn, primaryBtn } from "./ui";

/** Figma 2:2270 — session complete with daily score and streak. */
export function SummaryStep({
  view,
  streak,
}: {
  view: SessionView;
  streak: { current: number; longest: number };
}) {
  const s = view.session;
  const correct = view.writing.filter((w) => w.usesChunk).length;
  const improvement =
    s.speak1Score !== null && s.speak2Score !== null ? s.speak2Score - s.speak1Score : null;
  return (
    <div className="mx-auto max-w-[640px] text-center">
      <span
        aria-hidden
        className="bg-[#fff1b8] mx-auto grid size-[72px] place-items-center rounded-full"
      >
        <Star className="size-7 fill-[#5b4a00] text-[#5b4a00]" />
      </span>
      <Eyebrow className="mt-3">Session complete</Eyebrow>
      <h2 className="mt-2 text-[clamp(2rem,6vw,2.75rem)]">
        That was <em className="text-brand-link font-bold">brilliant.</em>
      </h2>
      {s.partial ? (
        <p className="text-muted-foreground mt-2">
          Some steps were skipped today, so your score is partial.
        </p>
      ) : null}

      <Card className="mt-7 flex items-center justify-center gap-8 text-left">
        <p className="text-5xl font-bold">
          {s.dailyScore}
          <span className="text-muted-foreground text-base">%</span>
        </p>
        <div>
          <Eyebrow className="text-brand-link">Today&apos;s score</Eyebrow>
          <p className="mt-1">
            {(s.dailyScore ?? 0) >= 80
              ? "A strong session!"
              : "Every session builds your confidence."}
          </p>
        </div>
      </Card>

      <ul className="mt-4 grid gap-3 text-left sm:grid-cols-3">
        <li className="bg-card rounded-2xl border p-4">
          <Volume2 aria-hidden className="text-muted-foreground size-4" />
          <p className="mt-1 font-bold">
            {s.speak2Score ?? "—"}
            {s.speak2Score !== null ? "%" : ""}
          </p>
          <p className="text-muted-foreground text-xs">Pronunciation</p>
          {improvement !== null ? (
            <p className="text-nav-active-foreground text-xs font-bold">
              {improvement >= 0 ? `+${improvement}` : improvement} since try 1
            </p>
          ) : null}
        </li>
        <li className="bg-card rounded-2xl border p-4">
          <PenLine aria-hidden className="text-muted-foreground size-4" />
          <p className="mt-1 font-bold">{correct}/3</p>
          <p className="text-muted-foreground text-xs">Writing</p>
        </li>
        <li className="bg-card rounded-2xl border p-4">
          <Flame aria-hidden className="text-muted-foreground size-4" />
          <p className="mt-1 font-bold">
            {streak.current} day{streak.current === 1 ? "" : "s"}
          </p>
          <p className="text-muted-foreground text-xs">Current streak · Best: {streak.longest}</p>
        </li>
      </ul>

      <blockquote className="mt-8">
        <p>“Small steps every day add up to big confidence.”</p>
        <footer className="text-muted-foreground mt-1 text-xs">— Mina, your English coach</footer>
      </blockquote>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <Link href="/progress" className={primaryBtn}>
          View my progress <TrendingUp aria-hidden className="size-4" />
        </Link>
        <Link href="/library" className={ghostBtn}>
          Explore the library
        </Link>
      </div>
    </div>
  );
}
