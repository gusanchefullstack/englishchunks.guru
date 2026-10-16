import { pgEnum } from "drizzle-orm/pg-core";

export const cefrLevels = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export type CefrLevel = (typeof cefrLevels)[number];
export const cefrLevel = pgEnum("cefr_level", cefrLevels);

export const chunkTypes = [
  "collocation",
  "idiom",
  "polyword",
  "vague_language",
  "sentence_frame",
  "verb_pattern",
  "discourse_marker",
] as const;
export type ChunkType = (typeof chunkTypes)[number];
export const chunkType = pgEnum("chunk_type", chunkTypes);

export const registers = ["casual", "academic", "professional"] as const;
export type Register = (typeof registers)[number];
export const register = pgEnum("register", registers);

export const exampleRegisters = ["casual", "professional"] as const;
export const exampleRegister = pgEnum("example_register", exampleRegisters);

export const userRoles = ["learner", "admin"] as const;
export type UserRole = (typeof userRoles)[number];

export const themes = ["light", "dark", "system"] as const;
export const theme = pgEnum("theme", themes);

export const planTiers = ["basic", "standard", "premium"] as const;
export type PlanTier = (typeof planTiers)[number];
export const planTier = pgEnum("plan_tier", planTiers);

export const subscriptionStatuses = [
  "none",
  "free_basic",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "expired",
] as const;
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export const subscriptionStatus = pgEnum("subscription_status", subscriptionStatuses);

export const sessionOrigin = pgEnum("session_origin", ["daily", "library"]);
export const sessionSteps = ["learn", "speak_1", "speak_2", "write", "read_aloud", "done"] as const;
export type SessionStep = (typeof sessionSteps)[number];
export const sessionStep = pgEnum("session_step", sessionSteps);
export const sessionStatus = pgEnum("session_status", ["in_progress", "completed", "abandoned"]);
export const attemptItems = [
  "chunk",
  "example_1",
  "example_2",
  "example_3",
  "sentence_1",
  "sentence_2",
  "sentence_3",
] as const;
export const attemptItem = pgEnum("attempt_item", attemptItems);

export const chunkSource = pgEnum("chunk_source", ["curated", "submitted"]);
export const auditStatus = pgEnum("audit_status", [
  "pending",
  "passed",
  "failed",
  "admin_approved",
]);
export const chunkStatus = pgEnum("chunk_status", ["active", "retired"]);
export const submissionStatus = pgEnum("submission_status", [
  "pending",
  "accepted",
  "rejected",
  "merged",
]);
export const pointsReason = pgEnum("points_reason", [
  "session",
  "streak_milestone",
  "submission_accepted",
  "admin_adjustment",
]);
export const notificationType = pgEnum("notification_type", [
  "submission_accepted",
  "submission_rejected",
  "reminder",
  "billing",
  "system",
]);
export const notificationChannel = pgEnum("notification_channel", ["in_app", "email"]);
export const waitlistStatus = pgEnum("waitlist_status", [
  "waiting",
  "invited",
  "registered",
  "expired",
]);
