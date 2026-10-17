"use server";

import { z } from "zod";
import { WaitlistInvite } from "@/emails/waitlist-invite";
import { renderEmail } from "@/emails/render";
import { requireAdmin } from "@/lib/authz";
import { logAdmin } from "@/lib/domain/audit";
import { inviteEntries, setAccountCap } from "@/lib/domain/signup-gate";
import { env } from "@/lib/env";
import { AppError, parseInput, toResult } from "@/lib/errors";
import { emailProvider } from "@/lib/providers/email";

export async function adminSetAccountCap(cap: number) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const value = parseInput(z.int().min(0).max(1_000_000), cap, "Enter a whole number.");
    await setAccountCap(value);
    await logAdmin(admin.id, "settings.account_cap", null, { cap: value });
    return value;
  });
}

export async function adminInviteFromWaitlist(entryIds: string[]) {
  return toResult(async () => {
    const admin = await requireAdmin();
    const ids = parseInput(z.array(z.uuid()).min(1).max(100), entryIds, "Choose who to invite.");
    const invites = await inviteEntries(admin.id, ids);
    const appUrl = env().BETTER_AUTH_URL.replace(/\/$/, "");
    for (const inv of invites) {
      const url = `${appUrl}/sign-up?invite=${encodeURIComponent(inv.token)}&email=${encodeURIComponent(inv.email)}`;
      const content = await renderEmail(WaitlistInvite({ url }));
      await emailProvider().send({
        to: inv.email,
        subject: "Your EnglishChunks.guru spot is ready",
        ...content,
      });
    }
    await logAdmin(admin.id, "waitlist.invite", null, { count: invites.length });
    if (!invites.length) throw new AppError("conflict", "Nobody to invite.");
    return invites.length;
  });
}
