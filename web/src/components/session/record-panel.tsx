"use client";

import { Loader2, Mic, MicOff, Square } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { AttemptResult } from "./types";
import { MAX_RECORDING_MS, useRecorder } from "./use-recorder";

/** Record → upload → result. The audio blob is only held until the upload finishes. */
export function RecordPanel({
  sessionId,
  step,
  item,
  onResult,
  onMicUnavailable,
  compact = false,
}: {
  sessionId: string;
  step: "speak_1" | "speak_2" | "read_aloud";
  item: string;
  onResult: (r: AttemptResult) => void;
  onMicUnavailable: () => void;
  compact?: boolean;
}) {
  const rec = useRecorder();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  async function toggle() {
    // Busy states keep the button focusable (aria-disabled) so keyboard focus isn't lost.
    if (uploading || rec.state === "requesting") return;
    if (rec.state === "recording") return rec.stop();
    setMessage("");
    const clip = await rec.start();
    if (!clip) {
      if (rec.state === "denied" || rec.state === "unsupported") onMicUnavailable();
      return;
    }
    setUploading(true);
    try {
      const form = new FormData();
      form.set("audio", clip.blob, "recording");
      form.set("step", step);
      form.set("item", item);
      form.set("mimeType", clip.mimeType);
      const res = await fetch(`/api/sessions/${sessionId}/attempts`, {
        method: "POST",
        body: form,
        headers: { accept: "application/x-ndjson, application/json" },
      });
      if (res.headers.get("content-type")?.includes("application/x-ndjson") && res.body) {
        await readStreamedResult(res.body, (r) => {
          setUploading(false); // the score is in; Mina's tip follows
          onResult(r);
        });
        return;
      }
      const body = await res.json();
      if (res.status === 200 || res.status === 422) {
        if (body.kind === "unusable") setMessage(unusableMessage(body.reason));
        onResult(body as AttemptResult);
      } else {
        setMessage(body?.error?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setMessage("You seem to be offline. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  const recording = rec.state === "recording";
  const seconds = Math.ceil((MAX_RECORDING_MS - rec.elapsed) / 1000);
  const denied = rec.state === "denied" || rec.state === "unsupported";

  return (
    <div className={cn("flex flex-col items-center gap-2", compact && "items-start")}>
      <button
        type="button"
        onClick={toggle}
        aria-disabled={uploading || rec.state === "requesting"}
        aria-busy={uploading || rec.state === "requesting"}
        aria-pressed={recording}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-colors aria-disabled:opacity-60",
          compact ? "bg-card min-h-11 border px-4 text-sm" : "size-20",
          !compact &&
            (recording ? "bg-destructive text-white" : "bg-primary text-primary-foreground"),
          compact && recording && "border-destructive text-destructive",
        )}
      >
        {uploading ? (
          <Loader2 aria-hidden className="size-5 animate-spin" />
        ) : recording ? (
          <Square aria-hidden className="size-5" />
        ) : denied ? (
          <MicOff aria-hidden className="size-5" />
        ) : (
          <Mic aria-hidden className={compact ? "size-4" : "size-7"} />
        )}
        <span className={compact ? "" : "sr-only"}>
          {uploading
            ? "Checking…"
            : recording
              ? `Stop (${seconds}s)`
              : compact
                ? "Record yourself"
                : "Tap to record"}
        </span>
      </button>
      {!compact ? (
        <p className="text-muted-foreground text-sm" aria-hidden>
          {uploading
            ? "Listening to your recording…"
            : recording
              ? `Recording… ${seconds}s left`
              : "Tap to record"}
        </p>
      ) : null}
      <p role="status" aria-live="polite" className="text-sm">
        {message}
      </p>
      {denied ? (
        <p className="text-muted-foreground max-w-sm text-center text-sm">
          We can&apos;t use your microphone. Allow microphone access in your browser settings, or
          skip the speaking part for today.
        </p>
      ) : null}
    </div>
  );
}

function unusableMessage(reason: string) {
  switch (reason) {
    case "no_speech":
    case "too_short":
      return "We couldn't hear you. Please try again a little closer to the microphone.";
    case "too_noisy":
      return "It's a bit noisy. Try again somewhere quieter.";
    case "wrong_content":
      return "That didn't sound like the sentence. Listen once more and try again.";
    default:
      return "We couldn't read that recording. Please try again.";
  }
}

const TIP_FALLBACK = "Nice try! Focus on the sounds below, then try again.";

/** Line 1: the score (tip: null). Line 2: { kind: "tip" }. Missing tip → plain message. */
async function readStreamedResult(
  stream: ReadableStream<Uint8Array>,
  onResult: (r: AttemptResult) => void,
) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let scored: Extract<AttemptResult, { kind: "scored" }> | undefined;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = JSON.parse(buffer.slice(0, nl)) as
          | Extract<AttemptResult, { kind: "scored" }>
          | { kind: "tip"; tip: string };
        buffer = buffer.slice(nl + 1);
        if (line.kind === "scored") {
          scored = line;
          onResult(line);
        } else if (scored) {
          scored = { ...scored, tip: line.tip };
          onResult(scored);
        }
      }
    }
  } finally {
    if (scored && scored.tip === null) onResult({ ...scored, tip: TIP_FALLBACK });
  }
}
