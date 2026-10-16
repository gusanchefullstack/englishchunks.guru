import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Db } from "@/db/client";
import { user } from "@/db/schema";
import { auth, resetAuth } from "@/lib/auth";
import { setTestEnv } from "@/lib/env";
import { createTestDb } from "../helpers/db";
import { captureEmails } from "../helpers/email";

let db: Db;
let close: () => Promise<void>;
const mail = captureEmails();

beforeAll(async () => {
  setTestEnv();
  ({ db, close } = await createTestDb());
  resetAuth();
});
afterAll(async () => {
  mail.restore();
  await close();
});

const creds = {
  email: "amira@example.com",
  password: "correct horse 9",
  name: "Amira",
  username: "amira_m",
};

describe("Better Auth on the Drizzle schema", () => {
  it("signs up a learner, stores defaults, and sends a verification email", async () => {
    await auth().api.signUpEmail({ body: creds });
    const [row] = await db.select().from(user).where(eq(user.email, creds.email));
    expect(row).toMatchObject({
      emailVerified: false,
      role: "learner",
      username: "amira_m",
      reminderHour: 19,
    });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.subject).toMatch(/confirm/i);
  });

  it("blocks sign-in until the email is verified (FR-002)", async () => {
    await expect(
      auth().api.signInEmail({ body: { email: creds.email, password: creds.password } }),
    ).rejects.toThrow();
  });

  it("rejects usernames outside [a-z0-9_]{3,24}", async () => {
    await expect(
      auth().api.signUpEmail({ body: { ...creds, email: "x@example.com", username: "No Spaces" } }),
    ).rejects.toThrow();
  });
});
