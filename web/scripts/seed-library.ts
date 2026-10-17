/**
 * Library seeding CLI (T146): Gemma draft → gpt-oss audit → espeak IPA → import.
 *
 *   DATABASE_URL=… AI_GATEWAY_API_KEY=… SCORING_URL=… SCORING_SHARED_SECRET=… (+ other env) \
 *   pnpm seed:library [--file scripts/seed-list.csv] [--limit 50] [--concurrency 4]
 *
 * Resumable: chunks already in the library are skipped. Audit failures are imported with
 * audit_status=failed and appear in Admin → Chunks → "Audit failed (review)".
 */
import { readFileSync, writeFileSync } from "node:fs";
import { countByLevel, parseSeedCsv, seedLibrary } from "@/lib/domain/library-seeding";

const arg = (name: string, fallback?: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const file = arg("file", "scripts/seed-list.csv")!;
const limit = Number(arg("limit", "0"));
const seeds = parseSeedCsv(readFileSync(file, "utf8"));
const batch = limit > 0 ? seeds.slice(0, limit) : seeds;
console.warn(`Seeding ${batch.length} of ${seeds.length} seeds from ${file}…`);

const report = await seedLibrary(batch, {
  concurrency: Number(arg("concurrency", "4")),
  onProgress: (o, done) =>
    console.warn(
      `[${done}/${batch.length}] ${o.result.padEnd(17)} ${o.text}${o.issues?.length ? ` — ${o.issues[0]}` : ""}`,
    ),
});
writeFileSync("scripts/seed-report.json", JSON.stringify(report, null, 2));
console.warn(
  `\nimported ${report.imported} · needs review ${report.needsReview} · skipped ${report.skipped} · errors ${report.errors}`,
);
console.warn("library by level:", await countByLevel());
process.exit(0);
