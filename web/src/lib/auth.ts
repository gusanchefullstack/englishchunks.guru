import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin, username } from "better-auth/plugins";
import { db } from "@/db/client";
import { account, rateLimit, session, user, verification } from "@/db/schema";
import { env } from "@/lib/env";
import { ResetPassword } from "@/emails/reset-password";
import { renderEmail } from "@/emails/render";
import { VerifyEmail } from "@/emails/verify-email";
import {
  afterAccountCreated,
  beforeAuth,
  gateAccountCreation,
  stampAgeConfirmation,
} from "@/lib/auth-hooks";
import { e2eMode } from "@/lib/e2e";
import { emailProvider } from "@/lib/providers/email";
import {
  PASSWORD_MAX,
  PASSWORD_MIN,
  USERNAME_MAX,
  USERNAME_MIN,
  USERNAME_RE,
} from "@/lib/account-rules";

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
      minPasswordLength: PASSWORD_MIN,
      maxPasswordLength: PASSWORD_MAX,
      // FR-002: password accounts cannot sign in (or practice) until the email is verified.
      requireEmailVerification: true,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user: u, url }) => {
        const { html, text } = await renderEmail(ResetPassword({ name: u.name, url }));
        await emailProvider().send({
          to: u.email,
          subject: "Reset your EnglishChunks.guru password",
          html,
          text,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      expiresIn: 60 * 60 * 24,
      sendVerificationEmail: async ({ user: u, url }) => {
        const { html, text } = await renderEmail(VerifyEmail({ name: u.name, url }));
        await emailProvider().send({
          to: u.email,
          subject: "Confirm your email for EnglishChunks.guru",
          html,
          text,
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
    hooks: { before: beforeAuth },
    databaseHooks: {
      user: {
        create: {
          before: async (u, ctx) => {
            await gateAccountCreation(u, ctx);
            return { data: stampAgeConfirmation(u, ctx?.path) };
          },
          after: async (u, ctx) => afterAccountCreated(u, ctx),
        },
      },
    },
    // Rate limiting stays on everywhere except the offline E2E mode (never in production).
    rateLimit: { enabled: !e2eMode(), window: 60, max: 30, storage: "database" },
    plugins: [
      username({
        minUsernameLength: USERNAME_MIN,
        maxUsernameLength: USERNAME_MAX,
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
