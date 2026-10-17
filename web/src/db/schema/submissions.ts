import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { chunk } from "./chunks";
import { id, timestamps } from "./columns";
import { submissionStatus } from "./enums";

export const chunkSubmission = pgTable(
  "chunk_submission",
  {
    id: id(),
    submittedBy: text().references(() => user.id, { onDelete: "set null" }),
    text: text().notNull(),
    normalizedText: text().notNull(), // dedupe key (lemmatized)
    proposedMeaning: text(),
    proposedExample: text(),
    matchedChunkIds: uuid().array().notNull().default([]),
    status: submissionStatus().notNull().default("pending"),
    mergedInto: uuid(), // first pending submission with the same key (credit goes there)
    reviewerId: text().references(() => user.id, { onDelete: "set null" }),
    decisionReason: text(),
    decidedAt: timestamp({ withTimezone: true }),
    resultingChunkId: uuid().references(() => chunk.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("chunk_submission_status_idx").on(t.status),
    index("chunk_submission_key_idx").on(t.normalizedText),
  ],
);
