"use server";

import { requireLearner } from "@/lib/authz";
import { searchChunks as search } from "@/lib/domain/library";
import { toResult } from "@/lib/errors";

export async function searchChunks(query: unknown) {
  return toResult(async () => {
    await requireLearner();
    return search(query);
  });
}
