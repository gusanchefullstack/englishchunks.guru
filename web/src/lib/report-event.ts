/**
 * Browser side of practice diagnostics (FR-074). Fire-and-forget: `keepalive` lets the report
 * outlive a page that is closing, and a failed report is simply dropped.
 */
type Step = "learn" | "speak_1" | "speak_2" | "write" | "read_aloud" | "done";

export type PracticeReport =
  | { kind: "mic_denied"; sessionId: string; step?: Step; reason: string }
  | { kind: "mic_unsupported"; sessionId: string; step?: Step }
  | { kind: "upload_failed"; sessionId: string; step?: Step; reason: string }
  | { kind: "page_error"; sessionId?: string; reason: string };

const MIC_ERRORS = new Set([
  "NotAllowedError",
  "NotFoundError",
  "NotReadableError",
  "SecurityError",
  "AbortError",
  "OverconstrainedError",
]);

/** Only allow-listed DOMException names leave the browser. */
export function micErrorCode(name: string) {
  return MIC_ERRORS.has(name) ? name : "unknown";
}

export function reportPracticeEvent(report: PracticeReport) {
  try {
    void fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(report),
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Diagnostics must never get in the learner's way.
  }
}
