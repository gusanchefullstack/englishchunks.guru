import { describe, expect, it } from "vitest";
import { USERNAME_RE, usernameProblem } from "@/lib/account-rules";

describe("usernameProblem (sign-up hints)", () => {
  it("says nothing for an empty or valid username", () => {
    expect(usernameProblem("")).toBe("");
    expect(usernameProblem("amira_m")).toBe("");
    expect(usernameProblem("abc")).toBe("");
  });

  it("names the rule that is broken", () => {
    expect(usernameProblem("amira m")).toMatch(/No spaces/);
    expect(usernameProblem("amira.m!")).toBe("Not allowed: . ! — use only a–z, 0–9 or _.");
    expect(usernameProblem("ab")).toBe("Too short — 1 more character needed.");
    expect(usernameProblem("a")).toBe("Too short — 2 more characters needed.");
    expect(usernameProblem("a".repeat(25))).toMatch(/Too long/);
  });

  it("agrees with the server's validator", () => {
    for (const name of ["amira_m", "ab", "Amira", "a b", "x".repeat(24), "x".repeat(25)])
      expect(usernameProblem(name) === "").toBe(USERNAME_RE.test(name));
  });
});
