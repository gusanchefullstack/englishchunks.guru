import { e2eMode, e2eOutbox } from "@/lib/e2e";

/** E2E only: read captured emails (404 everywhere else). */
export async function GET(request: Request) {
  if (!e2eMode()) return new Response(null, { status: 404 });
  const to = new URL(request.url).searchParams.get("to");
  return Response.json(e2eOutbox().filter((m) => !to || m.to === to));
}
