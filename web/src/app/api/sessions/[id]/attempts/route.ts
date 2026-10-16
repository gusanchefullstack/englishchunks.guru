import { AttemptInput, recordAttempt } from "@/lib/domain/attempts";
import { requireLearner } from "@/lib/authz";
import { AppError, errorResponse } from "@/lib/errors";

/** POST multipart: audio, step, item, mimeType → AttemptResult (contracts/web-api.md). */
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
    const result = await recordAttempt(
      { userId: learner.id, level: learner.level, timeZone: learner.timeZone },
      id,
      input.data,
      audio,
    );
    return Response.json(result, { status: result.kind === "unusable" ? 422 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
