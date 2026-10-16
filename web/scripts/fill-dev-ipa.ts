/**
 * Offline, deterministic IPA for the dev chunk seed (constitution II: IPA never comes from an LLM).
 * Reads src/db/seed/dev-chunks.source.json, runs espeak-ng (en-us, IPA), writes dev-chunks.json.
 * Usage: pnpm exec tsx scripts/fill-dev-ipa.ts  (requires espeak-ng on PATH)
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

type Source = {
  text: string;
  type: string;
  level: string;
  registers: string[];
  meaning: string;
  usageNote: string;
  examples: [string, string][];
};

export function espeakIpa(text: string): string {
  const out = execFileSync("espeak-ng", ["-v", "en-us", "-q", "--ipa", text], {
    encoding: "utf8",
  });
  return out.replace(/\s+/g, " ").trim();
}

const src: Source[] = JSON.parse(readFileSync("src/db/seed/dev-chunks.source.json", "utf8"));
const out = src.map((c) => ({
  ...c,
  ipa: espeakIpa(c.text),
  examples: c.examples.map(([text, register], i) => ({
    position: i + 1,
    text,
    register,
    ipa: espeakIpa(text),
  })),
}));
writeFileSync("src/db/seed/dev-chunks.json", JSON.stringify(out, null, 2) + "\n");
console.warn(`wrote ${out.length} chunks`);
