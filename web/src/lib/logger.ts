import pino from "pino";

/**
 * Structured JSON logger. Redacts anything that could carry personal content or secrets
 * (constitution IV): request bodies, emails, tokens, audio, learner sentences.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  redact: {
    paths: [
      "body",
      "*.body",
      "email",
      "*.email",
      "to",
      "token",
      "*.token",
      "password",
      "*.password",
      "authorization",
      "*.authorization",
      "cookie",
      "*.cookie",
      "audio",
      "*.audio",
      "sentence",
      "sentences",
      "*.sentences",
      "text",
      "*.text",
    ],
    censor: "[redacted]",
  },
  base: { service: "web" },
});

export function withRequestId(requestId: string) {
  return logger.child({ requestId });
}
