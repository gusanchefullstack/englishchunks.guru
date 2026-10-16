import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { addDays, parseISO } from "date-fns";

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function safeTz(tz: string | null | undefined) {
  return tz && isValidTimeZone(tz) ? tz : "UTC";
}

/** Learner-local calendar date (YYYY-MM-DD) for an instant (research R18). */
export function practiceDateFor(
  timeZone: string | null | undefined,
  instant: Date = new Date(),
): string {
  return formatInTimeZone(instant, safeTz(timeZone), "yyyy-MM-dd");
}

/** Learner-local hour 0–23 (reminders, FR-033). */
export function localHour(timeZone: string | null | undefined, instant: Date = new Date()): number {
  return Number(formatInTimeZone(instant, safeTz(timeZone), "H"));
}

/** The instant the learner's next practice day starts (shown when the daily limit is reached). */
export function nextDayStart(
  timeZone: string | null | undefined,
  instant: Date = new Date(),
): Date {
  const tz = safeTz(timeZone);
  const tomorrow = addDays(parseISO(practiceDateFor(tz, instant)), 1);
  return fromZonedTime(`${formatInTimeZone(tomorrow, "UTC", "yyyy-MM-dd")}T00:00:00`, tz);
}

/** Calendar-day difference between two YYYY-MM-DD dates (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
