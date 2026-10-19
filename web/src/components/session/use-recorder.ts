"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export const MAX_RECORDING_MS = 15_000;
const PREFERRED = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

export type RecorderState = "idle" | "requesting" | "recording" | "denied" | "unsupported";

/** Why no clip came back. `error` is the DOMException name (e.g. NotAllowedError). */
export type RecordOutcome =
  | { kind: "clip"; blob: Blob; mimeType: string }
  | { kind: "denied"; error: string }
  | { kind: "unsupported" }
  | { kind: "empty" };

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return PREFERRED.find((t) => MediaRecorder.isTypeSupported(t));
}

/** Base MIME type accepted by the scoring contract (codec parameters stripped). */
export function baseMime(t: string) {
  const base = t.split(";")[0]!.trim();
  return base === "audio/x-m4a" || base === "audio/aac" ? "audio/mp4" : base;
}

/**
 * Records one clip (≤ 15 s). Prefers WebM/Opus and falls back to MP4/AAC for iOS Safari,
 * reporting the recorder's actual mimeType (research R8). Audio stays in memory.
 */
export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const resolveRef = useRef<((r: RecordOutcome) => void) | null>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current = [];
  };

  useEffect(
    () => () => {
      clear();
      recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = useCallback(() => {
    const r = recorderRef.current;
    if (r && r.state === "recording") r.stop();
  }, []);

  /** Resolves when recording stops. The outcome says why, since `state` is stale in callers. */
  const start = useCallback(async (): Promise<RecordOutcome> => {
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setState("unsupported");
      return { kind: "unsupported" };
    }
    setState("requesting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      setState("denied");
      return { kind: "denied", error: err instanceof Error ? err.name : "unknown" };
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<RecordOutcome>((resolve) => (resolveRef.current = resolve));
    recorder.onstop = () => {
      clear();
      stream.getTracks().forEach((t) => t.stop());
      setState("idle");
      setElapsed(0);
      const type = recorder.mimeType || mimeType || "audio/webm";
      resolveRef.current?.(
        chunks.length
          ? { kind: "clip", blob: new Blob(chunks, { type }), mimeType: baseMime(type) }
          : { kind: "empty" },
      );
    };
    recorder.start();
    setState("recording");
    const began = Date.now();
    const tick = () => {
      setElapsed(Date.now() - began);
      timers.current.push(window.setTimeout(tick, 200));
    };
    tick();
    timers.current.push(window.setTimeout(() => stop(), MAX_RECORDING_MS));
    return done;
  }, [stop]);

  return { state, elapsed, start, stop };
}
