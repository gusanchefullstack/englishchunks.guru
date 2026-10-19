"use client";

import { ErrorPanel } from "@/components/error-panel";
import "./globals.css";

/** Replaces the root layout when it fails, so it brings its own <html> and <body>. */
export default function GlobalError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground flex min-h-screen flex-col">
        <ErrorPanel {...props} />
      </body>
    </html>
  );
}
