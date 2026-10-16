import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: { "server-only": new URL("./tests/helpers/empty.ts", import.meta.url).pathname },
  },
  test: {
    environment: "node",
    include: [
      "tests/unit/**/*.test.ts",
      "tests/integration/**/*.test.ts",
      "tests/contract/**/*.test.ts",
    ],
    setupFiles: ["tests/setup.ts"],
    // PGlite instances are per test file; keep files isolated.
    pool: "forks",
    testTimeout: 20_000,
    hookTimeout: 60_000,
    maxWorkers: 4,
    coverage: { provider: "v8", include: ["src/lib/**", "src/server/**"] },
  },
});
