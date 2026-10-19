import { describe, expect, it, vi } from "vitest";
import { isConnectionError, isRetryableRead, withReadRetry } from "@/db/retry";

const errorEvent = { type: "error", defaultPrevented: false };
const noSleep = () => Promise.resolve();

describe("database wake-up retry", () => {
  it("recognizes connection failures but not SQL errors", () => {
    expect(isConnectionError(errorEvent)).toBe(true);
    expect(isConnectionError(Object.assign(new Error("terminating"), { code: "57P01" }))).toBe(
      true,
    );
    expect(isConnectionError(new Error("Connection terminated unexpectedly"))).toBe(true);
    expect(isConnectionError(Object.assign(new Error("duplicate key"), { code: "23505" }))).toBe(
      false,
    );
    expect(isConnectionError(new Error("syntax error"))).toBe(false);
    expect(isConnectionError("boom")).toBe(false);
  });

  it("only treats plain selects as safe to repeat", () => {
    expect(isRetryableRead('select "id" from "session" where "token" = $1')).toBe(true);
    expect(isRetryableRead("  SELECT 1")).toBe(true);
    expect(isRetryableRead('insert into "attempt" values ($1)')).toBe(false);
    expect(isRetryableRead("with x as (delete from t returning *) select * from x")).toBe(false);
    expect(isRetryableRead(undefined)).toBe(false);
  });

  it("retries a read that hit a waking database, then succeeds", async () => {
    const run = vi
      .fn()
      .mockRejectedValueOnce(errorEvent)
      .mockResolvedValueOnce({ rows: [{ id: 1 }] });
    const onRetry = vi.fn();
    await expect(withReadRetry("select 1", run, { sleep: noSleep, onRetry })).resolves.toEqual({
      rows: [{ id: 1 }],
    });
    expect(run).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, errorEvent);
  });

  it("gives up after two retries", async () => {
    const run = vi.fn().mockRejectedValue(errorEvent);
    await expect(withReadRetry("select 1", run, { sleep: noSleep })).rejects.toBe(errorEvent);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("never repeats a write or a SQL error", async () => {
    const write = vi.fn().mockRejectedValue(errorEvent);
    await expect(withReadRetry("update t set x = 1", write, { sleep: noSleep })).rejects.toBe(
      errorEvent,
    );
    expect(write).toHaveBeenCalledTimes(1);
    const sqlError = Object.assign(new Error("duplicate key"), { code: "23505" });
    const read = vi.fn().mockRejectedValue(sqlError);
    await expect(withReadRetry("select 1", read, { sleep: noSleep })).rejects.toBe(sqlError);
    expect(read).toHaveBeenCalledTimes(1);
  });
});
