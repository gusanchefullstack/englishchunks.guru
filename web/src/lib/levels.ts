import type { CefrLevel } from "@/db/schema/enums";

export const LEVEL_LABELS: Record<CefrLevel, string> = {
  A1: "Beginner",
  A2: "Elementary",
  B1: "Intermediate",
  B2: "Upper intermediate",
  C1: "Advanced",
  C2: "Proficient",
};

export const LEVEL_DESCRIPTIONS: Record<CefrLevel, string> = {
  A1: "I know a few words and simple phrases.",
  A2: "I can handle short, familiar conversations.",
  B1: "I can talk about everyday topics.",
  B2: "I can speak with some fluency and detail.",
  C1: "I can express myself clearly and flexibly.",
  C2: "I understand almost everything with ease.",
};
