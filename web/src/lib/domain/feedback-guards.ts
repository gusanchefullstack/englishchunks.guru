import type { WritingFeedback } from "@/lib/contracts/llm";

// IPA letters (IPA Extensions block, length/stress marks, and IPA-only Latin letters).
const IPA_RE = /[ɐ-ʯʰ-˿æðθŋʃʒɹɾəɚɛɪʊʌɑɔ]/u;

/** True when the letters in `s` are (almost) all basic Latin a–z — a cheap English check. */
export function looksEnglish(s: string): boolean {
  const letters = [...s].filter((c) => /\p{L}/u.test(c));
  if (!letters.length) return true;
  const latin = letters.filter((c) => /[a-z]/i.test(c)).length;
  if (latin / letters.length < 0.97) return false;
  // Reject common non-English function words in otherwise Latin text.
  return !/\b(muy|bien|sigue|cada|très|est|parfait|sehr|gut|molto|bene|obrigado|você)\b/i.test(s);
}

/** Post-check for generated tips: reason to reject, or null if acceptable (FR-014). */
export function checkTip(message: string, input: { allowedNumbers: string[] }): string | null {
  if (IPA_RE.test(message) || /\/[^/\s]+\//.test(message)) return "contains IPA symbols";
  const numbers = message.match(/\d+/g) ?? [];
  if (numbers.some((n) => !input.allowedNumbers.includes(n)))
    return "contains a number not supplied by the app";
  if (!looksEnglish(message)) return "not in English";
  return null;
}

/** Post-check for writing feedback explanations and corrections (FR-016a). */
export function checkWriting(v: WritingFeedback): string | null {
  if (!looksEnglish(v.explanation)) return "explanation not in English";
  if (IPA_RE.test(v.explanation)) return "explanation contains IPA symbols";
  return null;
}
