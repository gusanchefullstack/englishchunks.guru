"use client";

import { Loader2, RotateCcw, Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Plays TTS for a reference (chunk:<id> | example:<id> | sentence:<id>). Audio is generated
 * on first play only (FR-012); replays reuse the loaded element. On failure the text stays
 * visible and a retry is offered (spec edge case).
 */
export function PlayButton({
  audioRef,
  voice,
  label = "Listen",
  showLabel = true,
  size = "md",
  className,
}: {
  audioRef: string;
  voice?: string;
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}) {
  const el = useRef<HTMLAudioElement | null>(null);
  const loadedSrc = useRef<string | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "playing" | "error">("idle");
  const v = voice ? `&voice=${encodeURIComponent(voice)}` : "";
  const src = `/api/tts?ref=${encodeURIComponent(audioRef)}${v}`;

  // The same button can be reused for another item (Speak step): stop the old audio when the
  // item changes or the button unmounts, so it never keeps playing the previous text.
  useEffect(
    () => () => {
      el.current?.pause();
    },
    [src],
  );

  async function play() {
    if (el.current && loadedSrc.current !== src) {
      el.current.pause();
      el.current = null;
    }
    if (!el.current) {
      loadedSrc.current = src;
      el.current = new Audio(src);
      el.current.onended = () => setStatus("idle");
      el.current.onerror = () => {
        el.current = null;
        setStatus("error");
      };
    }
    try {
      setStatus("loading");
      el.current.currentTime = 0;
      await el.current.play();
      setStatus("playing");
    } catch {
      el.current = null;
      setStatus("error");
    }
  }

  const dim = size === "sm" ? "size-9" : "size-10";
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={play}
        aria-label={status === "error" ? `Retry: ${label}` : label}
        className={cn(
          "bg-primary text-primary-foreground grid shrink-0 place-items-center rounded-full transition-transform active:scale-95",
          dim,
        )}
      >
        {status === "loading" ? (
          <Loader2 aria-hidden className="size-4 animate-spin" />
        ) : status === "error" ? (
          <RotateCcw aria-hidden className="size-4" />
        ) : (
          <Volume2 aria-hidden className="size-4" />
        )}
      </button>
      {showLabel ? (
        <span aria-hidden className="text-xs font-bold">
          {status === "error" ? "Try again" : label}
        </span>
      ) : null}
      <span role="status" aria-live="polite" className="sr-only">
        {status === "error" ? "Audio isn't available right now. You can still read the text." : ""}
      </span>
    </span>
  );
}
