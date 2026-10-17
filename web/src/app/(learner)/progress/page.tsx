import { BookOpen, Check, Flame, Mic, TrendingUp } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Segmented } from "@/components/progress/filters";
import { ScoreChart } from "@/components/progress/score-chart";
import { getProgress, type RangeDays } from "@/lib/domain/progress";
import { bandOf, getRanking } from "@/lib/domain/ranking";
import { initials } from "@/lib/domain/shell";
import { learnerOrRedirect } from "@/lib/page-guards";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Progress" };

type Search = { range?: string; scope?: string; period?: string };

export default function ProgressPage({ searchParams }: PageProps<"/progress">) {
  return (
    <Suspense
      fallback={
        <div aria-busy="true" className="bg-muted h-[600px] animate-pulse rounded-[20px]" />
      }
    >
      <ProgressContent searchParams={searchParams as Promise<Search>} />
    </Suspense>
  );
}

const card = "bg-card rounded-[20px] border p-5";
const eyebrow = "text-eyebrow text-xs font-bold tracking-[1.7px] uppercase";

async function ProgressContent({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const learner = await learnerOrRedirect();
  const range = (["7", "30", "90"].includes(sp.range ?? "") ? Number(sp.range) : 30) as RangeDays;
  const scope = sp.scope === "overall" ? "overall" : "band";
  const period = sp.period === "all" ? "all" : "week";
  const [p, r] = await Promise.all([
    getProgress(learner.id, range),
    getRanking({ userId: learner.id, level: learner.level, scope, period }),
  ]);
  const href = (patch: Partial<Search>) => {
    const q = new URLSearchParams({ range: String(range), scope, period, ...patch });
    return `/progress?${q.toString()}`;
  };
  const bandName = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" }[
    bandOf(learner.level)
  ];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className={eyebrow}>Your learning journey</p>
          <h1 className="mt-1 text-[34px] leading-tight tracking-[-1px]">
            Look how far you&apos;ve come.
          </h1>
          <p className="text-muted-foreground mt-1">
            Every session is building your real-world English.
          </p>
        </div>
        <Segmented
          label="Time range"
          current={String(range)}
          hrefFor={(v) => href({ range: v })}
          options={[
            { value: "7", label: "7 days" },
            { value: "30", label: "30 days" },
            { value: "90", label: "90 days" },
          ]}
        />
      </div>

      <ul aria-label="Highlights" className="mt-7 grid gap-3.5 sm:grid-cols-3">
        <li className={cn(card, "flex gap-4")}>
          <span aria-hidden className="bg-nav-active grid size-11 place-items-center rounded-xl">
            <Flame className="size-5" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              Current streak
            </p>
            <p className="text-3xl font-bold">
              {p.currentStreak}{" "}
              <span className="text-base font-normal">day{p.currentStreak === 1 ? "" : "s"}</span>
            </p>
            <p className="text-muted-foreground text-xs">
              Your longest is {p.longestStreak} day{p.longestStreak === 1 ? "" : "s"}
            </p>
          </div>
        </li>
        <li className={cn(card, "flex gap-4")}>
          <span aria-hidden className="bg-accent/40 grid size-11 place-items-center rounded-xl">
            <TrendingUp className="size-5" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              Average score
            </p>
            <p className="text-3xl font-bold">
              {p.averageScore ?? "—"}
              {p.averageScore !== null ? <span className="text-base">%</span> : null}
            </p>
            {p.averageChange !== null ? (
              <p className="text-nav-active-foreground text-xs font-bold">
                {p.averageChange >= 0 ? "↑" : "↓"} {Math.abs(p.averageChange)} vs previous {range}{" "}
                days
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">Last {range} days</p>
            )}
          </div>
        </li>
        <li className={cn(card, "flex gap-4")}>
          <span aria-hidden className="bg-tag-type grid size-11 place-items-center rounded-xl">
            <BookOpen className="size-5" />
          </span>
          <div>
            <p className="text-muted-foreground text-xs font-bold tracking-wide uppercase">
              Chunks learned
            </p>
            <p className="text-3xl font-bold">{p.chunksLearned}</p>
            <p className="text-muted-foreground text-xs">{p.totalPoints} points in total</p>
          </div>
        </li>
      </ul>

      <section
        aria-labelledby="ranking-title"
        className="bg-coach text-snow mt-5 grid gap-6 rounded-[20px] p-6 lg:grid-cols-[1fr_1.3fr]"
      >
        <div>
          <p className="text-mint text-xs font-bold tracking-[1.7px] uppercase">
            Community ranking
          </p>
          <h2 id="ranking-title" className="sr-only">
            Community ranking
          </h2>
          <p className="mt-3 text-6xl font-bold">{r.me ? `#${r.me.position}` : "—"}</p>
          <p className="mt-2 text-xl">
            {r.total > 1
              ? `Ahead of ${r.behindPct}% of learners`
              : "You're the first learner here!"}
          </p>
          <p className="text-coach-foreground mt-2 text-sm">
            {scope === "band" ? `Among ${bandName} learners` : "Among all learners"},{" "}
            {period === "week" ? "this week" : "all time"} · {r.me?.points ?? 0} points
          </p>
          {r.me && !r.me.visible ? (
            <p className="text-coach-foreground mt-2 text-xs">
              You&apos;re hidden from the public ranking — only you see your position.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-2 [&_nav]:bg-white/10 [&_a]:text-snow [&_a[aria-current]]:text-ink">
            <Segmented
              label="Ranking group"
              current={scope}
              hrefFor={(v) => href({ scope: v })}
              options={[
                { value: "band", label: "My level" },
                { value: "overall", label: "Everyone" },
              ]}
            />
            <Segmented
              label="Ranking period"
              current={period}
              hrefFor={(v) => href({ period: v })}
              options={[
                { value: "week", label: "This week" },
                { value: "all", label: "All time" },
              ]}
            />
          </div>
        </div>
        <div className="bg-card text-card-foreground rounded-2xl p-4">
          <p className="font-bold">Around your position</p>
          <p className="text-muted-foreground text-xs">
            Based on points {period === "week" ? "this week" : "all time"}
          </p>
          <ol className="mt-3 grid gap-1">
            {(r.around.length ? r.around : r.top.slice(0, 5)).map((e) => (
              <li
                key={e.userId}
                aria-current={e.isMe ? "true" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5",
                  e.isMe && "bg-nav-active",
                )}
              >
                <span className="text-muted-foreground w-8 text-sm font-bold">{e.position}</span>
                <Avatar className="size-8">
                  {e.image ? <AvatarImage src={e.image} alt="" /> : null}
                  <AvatarFallback className="bg-sky text-ink text-[10px] font-bold">
                    {initials(e.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">
                    {e.isMe ? "You" : e.name}
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    {e.streak > 0 ? `${e.streak}-day streak` : "Practicing"}
                  </span>
                </span>
                <span className="text-sm font-bold">{e.points.toLocaleString("en-US")} pts</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="chart-title" className={cn(card, "mt-5 p-6")}>
        <p className={eyebrow}>Daily score</p>
        <h2 id="chart-title" className="mt-1 text-xl">
          {p.averageChange !== null && p.averageChange > 0
            ? "Your confidence is climbing"
            : "Your daily scores"}
        </h2>
        <div className="mt-4">
          <ScoreChart days={p.days} range={range} />
        </div>
      </section>

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section aria-labelledby="week-title" className={cn(card, "p-6")}>
          <div className="flex items-start justify-between">
            <div>
              <p className={eyebrow}>This week</p>
              <h2 id="week-title" className="mt-1 text-lg">
                {p.weekPracticed} of 7 days practiced
              </h2>
            </div>
            {p.weekAverage !== null ? <p className="text-xl font-bold">{p.weekAverage}%</p> : null}
          </div>
          <ol className="mt-5 flex justify-between" aria-label="Days this week">
            {p.week.map((d) => (
              <li key={d.date} className="flex flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "grid size-9 place-items-center rounded-full text-xs font-bold",
                    d.practiced ? "bg-[#1dd6a4] text-white" : "bg-muted text-muted-foreground",
                  )}
                >
                  {d.practiced ? (
                    <Check aria-hidden className="size-4" />
                  ) : (
                    new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
                      weekday: "narrow",
                      timeZone: "UTC",
                    })
                  )}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(`${d.date}T12:00:00Z`).getUTCDate()}
                  <span className="sr-only">
                    {d.practiced ? " practiced" : d.future ? " upcoming" : " not practiced"}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </section>
        <section
          aria-labelledby="improve-title"
          className={cn(card, "flex items-center gap-5 p-6")}
        >
          <span
            aria-hidden
            className="bg-tag-level grid size-16 shrink-0 place-items-center rounded-full"
          >
            <Mic className="size-7" />
          </span>
          <div>
            <p className={eyebrow}>Practice makes progress</p>
            <h2 id="improve-title" className="mt-1 text-lg">
              {p.improvementTrend === null
                ? "Complete a session to see how much try 2 improves on try 1."
                : p.improvementTrend >= 0
                  ? `On average, try 2 scores ${p.improvementTrend} points higher than try 1.`
                  : `Try 2 is ${Math.abs(p.improvementTrend)} points below try 1 on average — use the tips between tries.`}
            </h2>
          </div>
        </section>
      </div>
    </div>
  );
}
