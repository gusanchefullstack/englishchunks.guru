import { isCronAuthorized } from "@/lib/cron-auth";
import { runDailyBilling } from "@/lib/domain/subscription";

async function run(request: Request) {
  if (!isCronAuthorized(request)) return new Response(null, { status: 401 });
  return Response.json(await runDailyBilling());
}

/** Vercel Cron calls GET with `Authorization: Bearer $CRON_SECRET`; POST for manual/Droplet runs. */
export const GET = run;
export const POST = run;
