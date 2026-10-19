"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ghostBtn, primaryBtn } from "@/components/session/ui";
import { reportPracticeEvent } from "@/lib/report-event";

const PRACTICE_PATH = /^\/practice\/([0-9a-f-]{36})/;

/**
 * Friendly stand-in for a page that failed to render (FR-074). Reports the failure once, with
 * the server's error digest (or "client" for a browser-side crash), then offers a retry.
 */
export function ErrorPanel({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    const sessionId = PRACTICE_PATH.exec(pathname ?? "")?.[1];
    const digest =
      error.digest && /^[A-Za-z0-9_-]{1,40}$/.test(error.digest) ? error.digest : "client";
    reportPracticeEvent({ kind: "page_error", sessionId, reason: digest });
  }, [error, pathname]);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-2xl font-bold">This page didn&apos;t load</h1>
      <p className="text-muted-foreground">
        Something went wrong on our side. Your practice is saved. Please try again.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" className={primaryBtn} onClick={reset}>
          Try again
        </button>
        <Link href="/today" className={ghostBtn}>
          Go to today
        </Link>
      </div>
    </main>
  );
}
