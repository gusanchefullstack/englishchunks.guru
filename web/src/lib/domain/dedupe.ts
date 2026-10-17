import { normalizeChunkText } from "./normalize";

/** Light, rule-based lemma for duplicate comparison ("spilled" → "spill", "decisions" → "decision"). */
export function lemma(word: string): string {
  if (word.length <= 3 || word === "_slot_") return word;
  const irregular: Record<string, string> = {
    made: "make",
    took: "take",
    taken: "take",
    gave: "give",
    given: "give",
    got: "get",
    gotten: "get",
    went: "go",
    gone: "go",
    came: "come",
    saw: "see",
    seen: "see",
    said: "say",
    kept: "keep",
    left: "leave",
    is: "be",
    are: "be",
    was: "be",
    were: "be",
    been: "be",
    has: "have",
    had: "have",
    does: "do",
    did: "do",
  };
  if (irregular[word]) return irregular[word];
  if (word.endsWith("ies") && word.length > 4) return `${word.slice(0, -3)}y`;
  // stop→stopped, get→getting double the final consonant; spill/miss/stuff already end doubled.
  const undouble = (w: string) => w.replace(/([bdgmnprt])\1$/, "$1");
  if (word.endsWith("ing") && word.length > 5) return undouble(word.slice(0, -3));
  if (word.endsWith("ed") && word.length > 4) return undouble(word.slice(0, -2));
  if (word.endsWith("es") && /(ch|sh|ss|x|z)es$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Comparison key: normalized text (case, punctuation, contractions, slots) with lemmatized words. */
export function dedupeKey(text: string): string {
  return normalizeChunkText(text).split(" ").filter(Boolean).map(lemma).join(" ");
}

/** pg_trgm-compatible trigrams: each word padded with two leading and one trailing space. */
function trigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (const w of s
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean)) {
    const p = `  ${w} `;
    for (let i = 0; i < p.length - 2; i++) out.add(p.slice(i, i + 3));
  }
  return out;
}

/** Same definition as pg_trgm `similarity()`: shared trigrams / union of trigrams. */
export function similarity(a: string, b: string): number {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / (ta.size + tb.size - shared);
}

export const SIMILAR_THRESHOLD = 0.6;

export type Candidate = { id: string; text: string };
export type DuplicateCheck<T extends Candidate> = {
  exact: T | null;
  similar: (T & { score: number })[];
};

/** FR-043 / research R13: exact on the key, then trigram ≥ threshold (top 3). */
export function findDuplicates<T extends Candidate>(
  text: string,
  candidates: T[],
): DuplicateCheck<T> {
  const key = dedupeKey(text);
  let exact: T | null = null;
  const scored: (T & { score: number })[] = [];
  for (const c of candidates) {
    const ck = dedupeKey(c.text);
    if (ck === key) {
      exact ??= c;
      continue;
    }
    const score = similarity(key, ck);
    if (score >= SIMILAR_THRESHOLD) scored.push({ ...c, score });
  }
  scored.sort((a, b) => b.score - a.score);
  return { exact, similar: scored.slice(0, 3) };
}
