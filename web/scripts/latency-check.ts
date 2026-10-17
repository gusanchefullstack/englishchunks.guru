/**
 * Latency check against a deployed environment (T149, SC-004 + writing feedback).
 *
 *   pnpm latency:check --base https://staging.englishchunks.guru --cookie "<better-auth session cookie>" [--n 20]
 *
 * TTS is measured through the real route (/api/tts → 302 → CDN), as a learner experiences it:
 * first play of never-played chunks (generation + upload) vs. an immediate replay (cache hit).
 * Writing feedback is measured with the configured LLM provider (needs AI_GATEWAY_API_KEY in env).
 * Results are printed and appended to docs/latency.md.
 */
import { appendFileSync } from "node:fs";
import { WritingFeedback } from "@/lib/contracts/llm";
import { buildWritingPrompt } from "@/lib/domain/prompts";
import { llm } from "@/lib/providers/llm";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const base = arg("base")?.replace(/\/$/, "");
const cookie = arg("cookie");
const n = Number(arg("n", "20"));
if (!base || !cookie) throw new Error("--base and --cookie are required");

const p95 = (xs: number[]) =>
  [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(0.95 * xs.length))] ?? NaN;
const headers = { cookie };

async function timed(url: string) {
  const t0 = performance.now();
  const res = await fetch(url, { headers, redirect: "follow" });
  await res.arrayBuffer();
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return performance.now() - t0;
}

const html = await (await fetch(`${base}/library`, { headers })).text();
const ids = [...new Set([...html.matchAll(/\/library\/([0-9a-f-]{36})/g)].map((m) => m[1]!))].slice(
  0,
  n,
);
if (!ids.length) throw new Error("no chunks found — is the cookie valid?");

const first: number[] = [];
const replay: number[] = [];
for (const id of ids) {
  first.push(await timed(`${base}/api/tts?ref=chunk:${id}`));
  replay.push(await timed(`${base}/api/tts?ref=chunk:${id}`));
}

const writing: number[] = [];
for (let i = 0; i < Math.min(n, 10); i++) {
  const t0 = performance.now();
  await llm.generate({
    role: "feedback",
    schema: WritingFeedback,
    ...buildWritingPrompt({
      level: "B1",
      chunkText: "that makes sense",
      meaning: "I understand the reason",
      sentence: `You missed the bus, so being late ${i ? "really " : ""}makes sense.`,
    }),
  });
  writing.push(performance.now() - t0);
}

const line = (label: string, xs: number[], target: number) =>
  `| ${label} | ${xs.length} | ${Math.round(p95(xs))} ms | ${target} ms | ${p95(xs) <= target ? "✅" : "❌"} |`;
const report = [
  `\n## ${new Date().toISOString()} — ${base}\n`,
  "| Measure | Samples | p95 | Target | |",
  "|---|---|---|---|---|",
  line("TTS first play (SC-004)", first, 2000),
  line("TTS cached replay (SC-004)", replay, 500),
  line("Writing feedback", writing, 6000),
].join("\n");
console.warn(report);
appendFileSync("docs/latency.md", `${report}\n`);
