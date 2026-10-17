import { AttemptInput, recordAttempt, type EarlyScored } from "@/lib/domain/attempts";
import { requireLearner } from "@/lib/authz";
import { AppError, errorResponse } from "@/lib/errors";

const NDJSON = "application/x-ndjson";

/**
 * POST multipart: audio, step, item, mimeType → AttemptResult (contracts/web-api.md).
 * With `Accept: application/x-ndjson` the score (+ curated hints) is streamed as soon as it is
 * known and Mina's tip follows as a second line, so learners don't wait for the LLM.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/sessions/[id]/attempts">) {
  try {
    const learner = await requireLearner();
    const { id } = await ctx.params;
    const form = await request.formData();
    const audio = form.get("audio");
    if (!(audio instanceof Blob)) throw new AppError("validation", "Missing recording.");
    const input = AttemptInput.safeParse({
      step: form.get("step"),
      item: form.get("item"),
      mimeType: String(form.get("mimeType") ?? "").split(";")[0],
    });
    if (!input.success) throw new AppError("validation", "Invalid recording details.");
    const sessionCtx = { userId: learner.id, level: learner.level, timeZone: learner.timeZone };

    if (!request.headers.get("accept")?.includes(NDJSON)) {
      const result = await recordAttempt(sessionCtx, id, input.data, audio);
      return Response.json(result, { status: result.kind === "unusable" ? 422 : 200 });
    }

    let onScored!: (e: EarlyScored) => void;
    const early = new Promise<EarlyScored>((resolve) => (onScored = resolve));
    const done = recordAttempt(sessionCtx, id, input.data, audio, { onScored });
    // Errors and unusable recordings never produce an early score: answer them as plain JSON.
    const first = await Promise.race([
      early.then((e) => ({ early: e }) as const),
      done.then((r) => ({ final: r }) as const),
    ]);
    if ("final" in first)
      return Response.json(first.final, { status: first.final.kind === "unusable" ? 422 : 200 });

    const enc = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({
      async start(controller) {
        controller.enqueue(enc.encode(`${JSON.stringify(first.early)}\n`));
        try {
          const r = await done;
          if (r.kind === "scored")
            controller.enqueue(enc.encode(`${JSON.stringify({ kind: "tip", tip: r.tip })}\n`));
        } catch {
          // The score is already stored and shown; the client keeps its plain message.
        }
        controller.close();
      },
    });
    return new Response(body, {
      headers: { "content-type": `${NDJSON}; charset=utf-8`, "cache-control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
