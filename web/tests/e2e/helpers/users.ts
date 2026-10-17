import type { APIRequestContext, BrowserContext } from "@playwright/test";
import pg from "pg";

export const E2E_DB =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres:dev@localhost:54329/englishchunks";

export async function sql<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const c = new pg.Client({ connectionString: E2E_DB });
  await c.connect();
  try {
    return (await c.query(text, params)).rows as T[];
  } finally {
    await c.end();
  }
}

/** Creates a verified, onboarded learner through the real auth API and signs the context in. */
export async function createSignedInLearner(
  request: APIRequestContext,
  context: BrowserContext,
  opts: { name: string; level?: string; extra?: string },
) {
  const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const email = `${opts.name.toLowerCase().replace(/\W/g, "")}.${id}@e2e.test`;
  const password = "e2e-password-123";
  const res = await request.post("/api/auth/sign-up/email", {
    data: {
      name: opts.name,
      username: `u_${id}`.slice(0, 24),
      email,
      password,
      ageConfirmed: true,
    },
  });
  if (!res.ok()) throw new Error(`sign-up failed ${res.status()} ${await res.text()}`);
  await sql(
    `update "user" set email_verified = true, level = $2, time_zone = 'UTC' ${opts.extra ? `, ${opts.extra}` : ""} where email = $1`,
    [email, opts.level ?? "B1"],
  );
  const signIn = await context.request.post("/api/auth/sign-in/email", {
    data: { email, password },
  });
  if (!signIn.ok()) throw new Error(`sign-in failed ${signIn.status()}`);
  const [u] = await sql<{ id: string }>(`select id from "user" where email = $1`, [email]);
  return { id: u!.id, email };
}
