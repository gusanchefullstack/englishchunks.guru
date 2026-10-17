"use server";

import { requireAdmin, requireLearner } from "@/lib/authz";
import { markAllRead } from "@/lib/domain/notifications";
import { decideSubmission } from "@/lib/domain/submission-review";
import { checkDuplicate, submitChunk as submit } from "@/lib/domain/submissions";
import { AppError, toResult } from "@/lib/errors";
import { rateLimit } from "@/lib/rate-limit";

export async function checkChunkDuplicate(text: string) {
  return toResult(async () => {
    const u = await requireLearner();
    await rateLimit("dup-check", 60, 60, u.id);
    return checkDuplicate(String(text ?? "").slice(0, 80));
  });
}

export async function submitChunk(input: unknown) {
  return toResult(async () => {
    const u = await requireLearner();
    try {
      const row = await submit(u, input);
      return { id: row.id, status: row.status };
    } catch (err) {
      if (err instanceof Error && err.name === "ZodError")
        throw new AppError("validation", "Please write a chunk of 2–80 characters.");
      throw err;
    }
  });
}

export async function adminDecideSubmission(input: unknown) {
  return toResult(async () => {
    const admin = await requireAdmin();
    try {
      return await decideSubmission(admin.id, input);
    } catch (err) {
      if (err instanceof Error && err.name === "ZodError")
        throw new AppError("validation", "Please complete every field (3 examples).");
      throw err;
    }
  });
}

export async function markNotificationsRead() {
  return toResult(async () => {
    const u = await requireLearner();
    await markAllRead(u.id);
    return true;
  });
}
