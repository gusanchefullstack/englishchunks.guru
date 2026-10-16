import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const fakeAudio = path.resolve(import.meta.dirname, "tests/e2e/fixtures/audio/chunk.wav");

const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgres://postgres:dev@localhost:54329/englishchunks";
const dummy = "e2e-only-not-a-secret-e2e-only-not-a-secret";

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/learner.json",
        launchOptions: {
          args: [
            "--use-fake-ui-for-media-stream",
            "--use-fake-device-for-media-stream",
            `--use-file-for-fake-audio-capture=${fakeAudio}`,
          ],
        },
      },
    },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm exec next dev --port 3100",
        url: "http://localhost:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        // E2E mode: real app + DB, deterministic fakes for LLM/TTS/storage/email/scoring.
        env: {
          E2E: "1",
          DATABASE_URL: E2E_DB,
          BETTER_AUTH_SECRET: dummy,
          BETTER_AUTH_URL: "http://localhost:3100",
          AI_GATEWAY_API_KEY: "e2e",
          ELEVENLABS_API_KEY: "e2e",
          SPACES_ENDPOINT: "https://spaces.e2e.test",
          SPACES_REGION: "e2e",
          SPACES_BUCKET: "e2e",
          SPACES_KEY: "e2e",
          SPACES_SECRET: "e2e",
          SPACES_CDN_URL: "https://cdn.e2e.test",
          RESEND_API_KEY: "e2e",
          EMAIL_FROM: "E2E <e2e@e2e.test>",
          SCORING_URL: "https://scoring.e2e.test",
          SCORING_SHARED_SECRET: dummy,
          CRON_SECRET: dummy,
          UNSUBSCRIBE_SECRET: dummy,
        },
      },
});
