import { db } from "@/db/client";
import { appSetting } from "@/db/schema";

export async function isBillingActive() {
  const [s] = await db().select({ active: appSetting.billingActive }).from(appSetting).limit(1);
  return s?.active ?? false;
}
