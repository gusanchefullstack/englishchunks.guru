import "server-only";
import { z } from "zod";

const secret = z.string().min(32, "must be at least 32 characters");

const schema = z.object({
  DATABASE_URL: z.url(),
  BETTER_AUTH_SECRET: secret,
  BETTER_AUTH_URL: z.url(),
  GOOGLE_CLIENT_ID: z.string().default(""),
  GOOGLE_CLIENT_SECRET: z.string().default(""),
  AI_GATEWAY_API_KEY: z.string().min(1),
  AI_FEEDBACK_MODEL: z.string().default("google/gemma-4-26b-a4b-it"),
  AI_AUDIT_MODEL: z.string().default("openai/gpt-oss-20b"),
  ELEVENLABS_API_KEY: z.string().min(1),
  ELEVENLABS_MODEL: z.string().default("eleven_flash_v2_5"),
  SPACES_ENDPOINT: z.url(),
  SPACES_REGION: z.string().min(1),
  SPACES_BUCKET: z.string().min(1),
  SPACES_KEY: z.string().min(1),
  SPACES_SECRET: z.string().min(1),
  SPACES_CDN_URL: z.url(),
  RESEND_API_KEY: z.string().min(1),
  EMAIL_FROM: z.string().min(3),
  SCORING_URL: z.url(),
  SCORING_SHARED_SECRET: secret,
  CRON_SECRET: secret,
  UNSUBSCRIBE_SECRET: secret,
  STRIPE_SECRET_KEY: z.string().default(""),
  STRIPE_WEBHOOK_SECRET: z.string().default(""),
  STRIPE_PRICE_BASIC: z.string().default(""),
  STRIPE_PRICE_STANDARD: z.string().default(""),
  STRIPE_PRICE_PREMIUM: z.string().default(""),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

/**
 * Validated server environment. Parsed on first use (not at import) so builds and tests
 * that never touch a provider don't need real keys. Fails fast with every missing name.
 * Tests can call `setTestEnv` instead of providing process.env.
 */
export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const names = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test-only override with safe placeholder values. */
export function setTestEnv(overrides: Partial<Env> = {}): Env {
  const s = "x".repeat(32);
  cached = schema.parse({
    DATABASE_URL: "postgres://test:test@localhost/test",
    BETTER_AUTH_SECRET: s,
    BETTER_AUTH_URL: "http://localhost:3000",
    AI_GATEWAY_API_KEY: "test",
    ELEVENLABS_API_KEY: "test",
    SPACES_ENDPOINT: "https://spaces.test",
    SPACES_REGION: "test",
    SPACES_BUCKET: "bucket",
    SPACES_KEY: "test",
    SPACES_SECRET: "test",
    SPACES_CDN_URL: "https://cdn.test",
    RESEND_API_KEY: "test",
    EMAIL_FROM: "Test <test@test.dev>",
    SCORING_URL: "https://scoring.test",
    SCORING_SHARED_SECRET: s,
    CRON_SECRET: s,
    UNSUBSCRIBE_SECRET: s,
    ...overrides,
  });
  return cached;
}
