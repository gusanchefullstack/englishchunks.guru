import { setEmailProvider, type EmailMessage } from "@/lib/providers/email";

/** Captures outgoing email instead of sending it. */
export function captureEmails() {
  const sent: EmailMessage[] = [];
  setEmailProvider({ send: async (m) => void sent.push(m) });
  return {
    sent,
    lastLink(): string {
      const m = sent.at(-1);
      const url = m?.text.match(/https?:\/\/\S+/)?.[0];
      if (!url) throw new Error("no link in last email");
      return url;
    },
    restore: () => setEmailProvider(undefined),
  };
}
