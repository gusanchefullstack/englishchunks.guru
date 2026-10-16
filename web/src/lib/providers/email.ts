import "server-only";
import { Resend } from "resend";
import { e2eMode, e2eOutbox } from "@/lib/e2e";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

class ResendEmailProvider implements EmailProvider {
  private client = new Resend(env().RESEND_API_KEY);

  async send(message: EmailMessage) {
    const { error } = await this.client.emails.send({ from: env().EMAIL_FROM, ...message });
    if (error) {
      // Never log the recipient or body (logger redacts, but keep it out entirely).
      logger.error({ err: error.name }, "email send failed");
      throw new Error("email_send_failed");
    }
  }
}

let provider: EmailProvider | undefined;

const outboxProvider: EmailProvider = {
  send: async (m) =>
    void e2eOutbox().push({
      to: m.to,
      subject: m.subject,
      text: m.text,
      at: new Date().toISOString(),
    }),
};

export function emailProvider(): EmailProvider {
  provider ??= e2eMode() ? outboxProvider : new ResendEmailProvider();
  return provider;
}

/** Test-only override. */
export function setEmailProvider(next: EmailProvider | undefined) {
  provider = next;
}

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}
