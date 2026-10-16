import { execSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { request, type FullConfig } from "@playwright/test";
import pg from "pg";

export const E2E_DB =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:dev@localhost:54329/englishchunks";
export const LEARNER = {
  email: "b1.learner@e2e.test",
  password: "e2e-password-123",
  name: "Amira Malik",
  username: "b1_learner",
};

/** Migrates + seeds the e2e DB and stores a signed-in, verified B1 learner session. */
export default async function globalSetup(config: FullConfig) {
  const env = { ...process.env, DATABASE_URL: E2E_DB };
  execSync("pnpm db:migrate && pnpm db:seed", { env, stdio: "inherit" });

  const client = new pg.Client({ connectionString: E2E_DB });
  await client.connect();
  await client.query(`delete from "user" where email = $1`, [LEARNER.email]);

  const baseURL = config.projects[0]!.use.baseURL!;
  const ctx = await request.newContext({ baseURL });
  const signUp = await ctx.post("/api/auth/sign-up/email", {
    data: { ...LEARNER, ageConfirmed: true },
  });
  if (!signUp.ok()) throw new Error(`sign-up failed: ${signUp.status()} ${await signUp.text()}`);
  await client.query(
    `update "user" set email_verified = true, level = 'B1', age_confirmed_at = now(), time_zone = 'UTC' where email = $1`,
    [LEARNER.email],
  );
  await client.end();

  const signIn = await ctx.post("/api/auth/sign-in/email", {
    data: { email: LEARNER.email, password: LEARNER.password },
  });
  if (!signIn.ok()) throw new Error(`sign-in failed: ${signIn.status()} ${await signIn.text()}`);
  mkdirSync("tests/e2e/.auth", { recursive: true });
  await ctx.storageState({ path: "tests/e2e/.auth/learner.json" });
  await ctx.dispose();
}
