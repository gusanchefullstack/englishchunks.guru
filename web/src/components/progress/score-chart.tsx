"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Day = { date: string; score: number | null };

const fmt = (date: string, range: number) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString(
    "en-US",
    range <= 7
      ? { weekday: "short", timeZone: "UTC" }
      : { month: "short", day: "numeric", timeZone: "UTC" },
  );

/** Single-series daily score (one hue, no legend; title names the series). */
export function ScoreChart({ days, range }: { days: Day[]; range: number }) {
  const data = days.map((d) => ({ ...d, label: fmt(d.date, range) }));
  const practiced = days.filter((d) => d.score !== null);
  const summary = practiced.length
    ? `Daily scores for the last ${range} days: ${practiced.length} practice days, latest ${practiced.at(-1)!.score}.`
    : `No practice in the last ${range} days yet.`;
  return (
    <figure>
      <div role="img" aria-label={summary} className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 8, right: 4, bottom: 0, left: -20 }}
            barCategoryGap={range > 30 ? 1 : 2}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis
              domain={[0, 100]}
              ticks={[0, 25, 50, 75, 100]}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: 12,
                color: "var(--popover-foreground)",
              }}
              formatter={(v) => [v === null ? "No practice" : `${v}%`, "Daily score"]}
              labelFormatter={(_, p) =>
                p?.[0]?.payload?.date
                  ? new Date(`${p[0].payload.date}T12:00:00Z`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      timeZone: "UTC",
                    })
                  : ""
              }
            />
            <Bar
              dataKey="score"
              fill="var(--chart-bar)"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-3 text-sm">
        <summary className="text-muted-foreground cursor-pointer">Show as a table</summary>
        <table className="mt-2 w-full text-left">
          <caption className="sr-only">Daily scores</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th scope="col" className="py-1 font-normal">
                Date
              </th>
              <th scope="col" className="py-1 font-normal">
                Score
              </th>
            </tr>
          </thead>
          <tbody>
            {practiced.map((d) => (
              <tr key={d.date} className="border-t">
                <td className="py-1">
                  {new Date(`${d.date}T12:00:00Z`).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    timeZone: "UTC",
                  })}
                </td>
                <td className="py-1 font-bold">{d.score}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
