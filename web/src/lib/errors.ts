export const errorCodes = [
  "unauthenticated",
  "forbidden",
  "validation",
  "limit_reached",
  "not_found",
  "conflict",
  "unavailable",
  "billing_inactive",
  "needs_onboarding",
] as const;
export type ErrorCode = (typeof errorCodes)[number];

const httpStatus: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  validation: 400,
  limit_reached: 429,
  not_found: 404,
  conflict: 409,
  unavailable: 503,
  billing_inactive: 409,
  needs_onboarding: 403,
};

/** Domain error carried across server actions and route handlers (contracts/web-api.md). */
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
  }

  get status() {
    return httpStatus[this.code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.details ?? {}) } };
  }
}

export type Result<T> =
  { ok: true; data: T } | { ok: false; error: { code: ErrorCode; message: string } };

/** Wraps a server-action body so callers always get a serializable Result. */
export async function toResult<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    if (err instanceof AppError)
      return { ok: false, error: { code: err.code, message: err.message } };
    throw err;
  }
}

/** Route-handler helper: AppError → JSON response with the right status. */
export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) return Response.json(err.toJSON(), { status: err.status });
  throw err;
}
