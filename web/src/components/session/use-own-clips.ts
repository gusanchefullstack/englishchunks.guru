"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { OwnClips } from "@/lib/own-clips";

/**
 * The learner's latest recording per item, for "Hear yourself" (FR-075). Lives as long as the
 * step component: released when it unmounts (step or practice ends) or the page is left.
 */
export function useOwnClips() {
  const store = useRef<OwnClips | null>(null);
  store.current ??= new OwnClips();
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const clips = store.current!;
    const onPageHide = () => {
      clips.clear();
      rerender();
    };
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      clips.clear();
    };
  }, []);

  const set = useCallback((key: string, blob: Blob) => {
    store.current!.set(key, blob);
    rerender();
  }, []);
  const url = (key: string) => store.current!.get(key);

  return { set, url };
}
