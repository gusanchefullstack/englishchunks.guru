"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { sessionSteps } from "@/db/schema";
import { requireLearner } from "@/lib/authz";
import * as engine from "@/lib/domain/session-engine";
import { submitWriting as gradeWriting } from "@/lib/domain/writing";
import { parseInput, toResult } from "@/lib/errors";

async function ctx() {
  const l = await requireLearner();
  return { userId: l.id, level: l.level, timeZone: l.timeZone };
}

const Id = z.uuid();

export async function startDailySession() {
  return toResult(async () => engine.startDailySession(await ctx()));
}

/** Form action for the "Start today's chunk" button: creates (or resumes) and navigates. */
export async function startTodayAndGo(): Promise<{ error: string } | undefined> {
  const res = await startDailySession();
  if (!res.ok) return { error: res.error.message };
  redirect(`/practice/${res.data.id}`);
}

/** Form action for "Practice this" on a library chunk. */
export async function practiceChunkAndGo(chunkId: string): Promise<{ error: string } | undefined> {
  const res = await startLibrarySession(chunkId);
  if (!res.ok) return { error: res.error.message };
  redirect(`/practice/${res.data.id}`);
}

export async function startLibrarySession(chunkId: string) {
  return toResult(async () => engine.startLibrarySession(await ctx(), parseInput(Id, chunkId)));
}

export async function advanceStep(sessionId: string, from: string) {
  return toResult(async () =>
    engine.advanceStep(
      await ctx(),
      parseInput(Id, sessionId),
      parseInput(z.enum(sessionSteps), from),
    ),
  );
}

export async function skipSpeaking(sessionId: string) {
  return toResult(async () => engine.skipSpeaking(await ctx(), parseInput(Id, sessionId)));
}

export async function completeSession(sessionId: string) {
  return toResult(async () => engine.completeSession(await ctx(), parseInput(Id, sessionId)));
}

const Sentences = z.tuple([
  z.string().trim().min(1).max(300),
  z.string().trim().min(1).max(300),
  z.string().trim().min(1).max(300),
]);

export async function submitWriting(sessionId: string, sentences: string[]) {
  return toResult(async () =>
    gradeWriting(
      await ctx(),
      parseInput(Id, sessionId),
      parseInput(Sentences, sentences, "Write three sentences (up to 300 characters each)."),
    ),
  );
}
