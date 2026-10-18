"use server";

import { z } from "zod";
import { requireAdmin } from "@/lib/authz";
import { approveChunk, setChunkStatus, upsertChunk } from "@/lib/domain/admin-chunks";
import { createUser, removeUser, setSuspended, updateUser } from "@/lib/domain/admin-users";
import { AppError, toResult } from "@/lib/errors";

/** Every admin action re-checks the role server-side (FR-050). Zod issues become `validation`. */
async function adminAction<T>(fn: (adminId: string) => Promise<T>) {
  return toResult(async () => {
    const admin = await requireAdmin();
    try {
      return await fn(admin.id);
    } catch (err) {
      if (err instanceof z.ZodError)
        throw new AppError("validation", "Please check the highlighted fields.");
      throw err;
    }
  });
}

const Id = z.string().min(1).max(64);

export async function adminCreateUser(input: unknown) {
  return adminAction((a) => createUser(a, input));
}
export async function adminUpdateUser(id: string, input: unknown) {
  return adminAction((a) => updateUser(a, Id.parse(id), input));
}
export async function adminSuspendUser(id: string, suspended: boolean, reason?: string) {
  return adminAction((a) => setSuspended(a, Id.parse(id), suspended, reason));
}
export async function adminDeleteUser(id: string, confirm: string) {
  return adminAction(async (a) => {
    if (confirm !== "DELETE") throw new AppError("validation", 'Type "DELETE" to confirm.');
    await removeUser(a, Id.parse(id));
    return true;
  });
}
export async function adminUpsertChunk(id: string | null, input: unknown) {
  return adminAction((a) => upsertChunk(a, id ? z.uuid().parse(id) : null, input));
}
export async function adminApproveChunk(id: string) {
  return adminAction((a) => approveChunk(a, z.uuid().parse(id)));
}
export async function adminRetireChunk(id: string, retire: boolean) {
  return adminAction((a) => setChunkStatus(a, z.uuid().parse(id), retire ? "retired" : "active"));
}
