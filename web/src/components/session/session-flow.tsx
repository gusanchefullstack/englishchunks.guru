"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { SessionStep } from "@/db/schema";
import type { Result } from "@/lib/errors";
import { advanceStep, completeSession, skipSpeaking } from "@/server/actions/session";
import { LearnStep } from "./learn-step";
import { ReadAloudStep } from "./read-aloud-step";
import { SpeakStep } from "./speak-step";
import type { SessionView } from "./types";
import { WriteStep } from "./write-step";

/** Drives one practice session; every transition goes through a server action (FR-021). */
export function SessionFlow({ view }: { view: SessionView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function run(action: () => Promise<Result<unknown>>) {
    setBusy(true);
    startTransition(async () => {
      const res = await action();
      setBusy(false);
      if (!res.ok) {
        toast.error(res.error.message);
        return;
      }
      router.refresh();
      document.getElementById("main")?.focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  const id = view.session.id;
  const next = (from: SessionStep) => () => run(() => advanceStep(id, from));
  const skip = () => run(() => skipSpeaking(id));
  const isBusy = busy || pending;

  switch (view.session.step) {
    case "learn":
      return <LearnStep view={view} onNext={next("learn")} busy={isBusy} />;
    case "speak_1":
    case "speak_2":
      return (
        <SpeakStep
          key={view.session.step}
          view={view}
          step={view.session.step}
          onNext={next(view.session.step)}
          onSkip={skip}
          busy={isBusy}
        />
      );
    case "write":
      return <WriteStep view={view} onNext={next("write")} busy={isBusy} />;
    case "read_aloud":
      return (
        <ReadAloudStep
          view={view}
          onFinish={() => run(() => completeSession(id))}
          onSkip={skip}
          busy={isBusy}
        />
      );
    case "done":
      return null;
  }
}
