"use client";

import { ErrorPanel } from "@/components/error-panel";

export default function ErrorPage(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorPanel {...props} />;
}
