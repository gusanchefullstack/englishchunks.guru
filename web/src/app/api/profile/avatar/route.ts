import { requireVerifiedUser } from "@/lib/authz";
import { MAX_AVATAR_BYTES, setAvatar } from "@/lib/domain/avatar";
import { AppError, errorResponse } from "@/lib/errors";

/** POST multipart `image` → { imageUrl } (FR-005). */
export async function POST(request: Request) {
  try {
    const u = await requireVerifiedUser();
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > MAX_AVATAR_BYTES + 64 * 1024)
      throw new AppError("validation", "That picture is larger than 5 MB.");
    const file = (await request.formData()).get("image");
    if (!(file instanceof Blob)) throw new AppError("validation", "Please choose a picture.");
    return Response.json(await setAvatar(u.id, new Uint8Array(await file.arrayBuffer())));
  } catch (err) {
    return errorResponse(err);
  }
}
