import { describe, expect, it } from "vitest";
import { authorizeAdmin, authorizeLearner, type SessionUser } from "@/lib/authz";
import type { AppError } from "@/lib/errors";

const base: SessionUser = {
  id: "u1",
  email: "a@b.dev",
  name: "A",
  emailVerified: true,
  role: "learner",
  banned: false,
  level: "B1",
};

function codeOf(fn: () => unknown) {
  try {
    fn();
    return "ok";
  } catch (e) {
    return (e as AppError).code;
  }
}

describe("authorizeLearner", () => {
  it("accepts a verified, active, onboarded learner", () => {
    expect(authorizeLearner(base)).toBe(base);
  });
  it("rejects missing sessions", () => {
    expect(codeOf(() => authorizeLearner(null))).toBe("unauthenticated");
  });
  it("rejects unverified email (FR-002)", () => {
    expect(codeOf(() => authorizeLearner({ ...base, emailVerified: false }))).toBe("forbidden");
  });
  it("rejects suspended users", () => {
    expect(codeOf(() => authorizeLearner({ ...base, banned: true }))).toBe("forbidden");
  });
  it("requires a level unless onboarding is allowed (FR-003)", () => {
    expect(codeOf(() => authorizeLearner({ ...base, level: null }))).toBe("needs_onboarding");
    expect(codeOf(() => authorizeLearner({ ...base, level: null }, { allowNoLevel: true }))).toBe(
      "ok",
    );
  });
});

describe("authorizeAdmin (FR-050)", () => {
  it("rejects learners", () => {
    expect(codeOf(() => authorizeAdmin(base))).toBe("forbidden");
  });
  it("accepts admins even without a level", () => {
    expect(codeOf(() => authorizeAdmin({ ...base, role: "admin", level: null }))).toBe("ok");
  });
  it("rejects suspended admins", () => {
    expect(codeOf(() => authorizeAdmin({ ...base, role: "admin", banned: true }))).toBe(
      "forbidden",
    );
  });
});
