/** Mother-tongue options (ISO 639-1). Stored for future personalization (spec assumption). */
const PAIRS: [string, string][] = [
  ["ar", "Arabic"],
  ["bn", "Bengali"],
  ["zh", "Chinese"],
  ["cs", "Czech"],
  ["nl", "Dutch"],
  ["fa", "Persian"],
  ["fr", "French"],
  ["de", "German"],
  ["el", "Greek"],
  ["gu", "Gujarati"],
  ["he", "Hebrew"],
  ["hi", "Hindi"],
  ["hu", "Hungarian"],
  ["id", "Indonesian"],
  ["it", "Italian"],
  ["ja", "Japanese"],
  ["kk", "Kazakh"],
  ["ko", "Korean"],
  ["ms", "Malay"],
  ["mr", "Marathi"],
  ["ne", "Nepali"],
  ["pl", "Polish"],
  ["pt", "Portuguese"],
  ["pa", "Punjabi"],
  ["ro", "Romanian"],
  ["ru", "Russian"],
  ["es", "Spanish"],
  ["sw", "Swahili"],
  ["sv", "Swedish"],
  ["tl", "Tagalog"],
  ["ta", "Tamil"],
  ["te", "Telugu"],
  ["th", "Thai"],
  ["tr", "Turkish"],
  ["uk", "Ukrainian"],
  ["ur", "Urdu"],
  ["uz", "Uzbek"],
  ["vi", "Vietnamese"],
  ["yo", "Yoruba"],
  ["zu", "Zulu"],
];
export const LANGUAGES = PAIRS.map(([code, name]) => ({ code, name }));

export const languageName = (code: string | null | undefined) =>
  LANGUAGES.find((l) => l.code === code)?.name ?? "Not set";

export function hourLabel(h: number) {
  return `${h % 12 === 0 ? 12 : h % 12}:00 ${h < 12 ? "AM" : "PM"}`;
}
