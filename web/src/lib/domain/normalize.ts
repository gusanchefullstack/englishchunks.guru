/**
 * Canonical form of a chunk used for uniqueness and duplicate detection (research R13).
 * Lowercases, unifies quotes, expands common contractions, replaces slot markers such as
 * "[do something]" / "someone" with a token, and strips punctuation.
 */
const CONTRACTIONS: Record<string, string> = {
  "i'm": "i am",
  "you're": "you are",
  "it's": "it is",
  "that's": "that is",
  "how's": "how is",
  "what's": "what is",
  "don't": "do not",
  "doesn't": "does not",
  "can't": "cannot",
  "won't": "will not",
  "isn't": "is not",
  "aren't": "are not",
  "i'll": "i will",
  "let's": "let us",
};

export function normalizeChunkText(input: string): string {
  let s = input.toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"');
  s = s.replace(/\[[^\]]*\]/g, " _slot_ ");
  s = s.replace(/\b(someone|somebody|something)\b/g, "_slot_");
  s = s
    .split(/\s+/)
    .map((w) => CONTRACTIONS[w.replace(/[^a-z']/g, "")] ?? w)
    .join(" ");
  s = s.replace(/[^a-z_\s-]/g, " ").replace(/-/g, " ");
  return s.replace(/\s+/g, " ").trim();
}
