"use server";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { requireVerifiedUser } from "@/lib/authz";
import { deleteAccount as eraseAccount } from "@/lib/domain/account-deletion";
import {
  confirmAge,
  LevelChoice,
  ProfileUpdate,
  setLevel as saveLevel,
  updateProfile as saveProfile,
} from "@/lib/domain/profile";
import { AppError, parseInput, toResult } from "@/lib/errors";

export async function setLevel(choice: string) {
  return toResult(async () => {
    const u = await requireVerifiedUser();
    return saveLevel(u.id, parseInput(LevelChoice, choice, "Please choose a level."));
  });
}

export async function confirmAgeAction(confirmed: boolean) {
  return toResult(async () => {
    const u = await requireVerifiedUser();
    if (confirmed !== true) throw new AppError("validation", "Please confirm you are 16 or older.");
    await confirmAge(u.id);
    return true;
  });
}

export async function updateProfile(input: unknown) {
  return toResult(async () => {
    const u = await requireVerifiedUser();
    const row = await saveProfile(u.id, parseInput(ProfileUpdate, input));
    return { name: row.name, theme: row.theme };
  });
}

/** FR-008: confirm by typing DELETE; erases data and signs out. */
export async function deleteAccount(confirm: string) {
  return toResult(async () => {
    const u = await requireVerifiedUser();
    if (confirm !== "DELETE") throw new AppError("validation", 'Type "DELETE" to confirm.');
    await eraseAccount(u.id);
    await auth()
      .api.signOut({ headers: await headers() })
      .catch(() => undefined);
    return true;
  });
}
