import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "@/db/client";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { env } from "@/lib/env";
import { emailProvider, escapeHtml } from "@/lib/providers/email";

const USERNAME_RE = /^[a-z0-9_]{3,24}$/;

function createAuth() {
  const e = env();
  return betterAuth({
    secret: e.BETTER_AUTH_SECRET,
    baseURL: e.BETTER_AUTH_URL,
    database: drizzleAdapter(db(), {
      provider: "pg",
      schema: { user, session, account, verification, rateLimit },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // FR-002: password accounts cannot sign in (or practice) until the email is verified.
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: u, url }) => {
        await emailProvider().send({
          to: u.email,
          subject: "Reset your EnglishChunks.guru password",
          text: `Use this link to choose a new password (valid for 1 hour, one use only): ${url}`,
          html: `<p>Use this link to choose a new password (valid for 1 hour, one use only):</p><p><a href="${escapeHtml(url)}">Reset my password</a></p>`,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user: u, url }) => {
        await emailProvider().send({
          to: u.email,
          subject: "Confirm your email for EnglishChunks.guru",
          text: `Welcome! Confirm your email to start your first chunk: ${url}`,
          html: `<p>Welcome! Confirm your email to start your first chunk.</p><p><a href="${escapeHtml(url)}">Confirm my email</a></p>`,
        });
      },
    },
    socialProviders: e.GOOGLE_CLIENT_ID
      ? { google: { clientId: e.GOOGLE_CLIENT_ID, clientSecret: e.GOOGLE_CLIENT_SECRET } }
      : {},
    account: {
      accountLinking: {
        enabled: true,
        // Spec edge case + analysis I1: a Google sign-in whose email belongs to an existing
        // password account is refused; the learner must sign in with the password first and
        // then link Google explicitly (linkSocial requires that authenticated session).
        disableImplicitLinking: true,
        trustedProviders: [],
      },
    },
    user: {
      additionalFields: {
        timeZone: { type: "string", required: false, input: true, defaultValue: "UTC" },
        level: { type: "string", required: false, input: false },
        ageConfirmedAt: { type: "date", required: false, input: false },
        earlyTester: { type: "boolean", required: false, input: false },
      },
    },
    rateLimit: { enabled: true, window: 60, max: 30, storage: "database" },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 24,
        usernameValidator: (name) => USERNAME_RE.test(name),
      }),
      admin({ defaultRole: "learner", adminRoles: ["admin"] }),
      nextCookies(),
    ],
  });
}

type Auth = ReturnType<typeof createAuth>;
let instance: Auth | undefined;

export function auth(): Auth {
  instance ??= createAuth();
  return instance;
}

/** Test-only: rebuild against the current db()/env(). */
export function resetAuth() {
  instance = undefined;
}
