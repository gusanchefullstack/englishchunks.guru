import { afterAll, afterEach, beforeAll } from "vitest";
import { server } from "./mocks/server";

// Any request without a matching MSW handler fails the test, so the suite can never
// reach a real paid provider.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
