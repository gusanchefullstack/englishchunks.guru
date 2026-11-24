"use client";

import { Headphones, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Plays the learner's own latest recording from memory (FR-075), so they can compare it with
 * the guide audio. Only starts from a tap; stops when the clip is replaced or the button goes.
 */
export function OwnClipButton({
  url,
  label = "Hear yourself",
  ariaLabel,
  size = "md",
  className,
}: {
  url: string;
  label?: string;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const el = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(
    () => () => {
      el.current?.pause();
      el.current = null;
    },
    [url],
  );

  async function toggle() {
    if (playing && el.current) {
      el.current.pause();
      return;
    }
    if (!el.current) {
      const audio = new Audio(url);
      audio.onended = () => setPlaying(false);
      audio.onpause = () => setPlaying(false);
      audio.onerror = () => {
        setPlaying(false);
        setFailed(true);
      };
      el.current = audio;
    }
    try {
      el.current.currentTime = 0;
      await el.current.play();
      setFailed(false);
      setPlaying(true);
    } catch {
      setPlaying(false);
      setFailed(true);
    }
  }

  const dim = size === "sm" ? "size-9" : "size-10";
  const name = ariaLabel ?? label;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Stop: ${name}` : name}
        className={cn(
          "border-primary text-primary bg-card grid shrink-0 place-items-center rounded-full border-2 transition-transform active:scale-95",
          dim,
        )}
      >
        {playing ? (
          <Square aria-hidden className="size-4" />
        ) : (
          <Headphones aria-hidden className="size-4" />
        )}
      </button>
      <span aria-hidden className="text-xs font-bold">
        {label}
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {failed ? "Your recording can't be played on this browser." : ""}
      </span>
    </span>
  );
}
