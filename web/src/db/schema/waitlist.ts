import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { id, timestamps } from "./columns";
import { waitlistStatus } from "./enums";

export const waitlistEntry = pgTable("waitlist_entry", {
  id: id(),
  email: text().notNull().unique(), // stored lowercased
  status: waitlistStatus().notNull().default("waiting"),
  inviteTokenHash: text(), // sha256 of the single-use token; the token itself is never stored
  invitedBy: text().references(() => user.id, { onDelete: "set null" }),
  invitedAt: timestamp({ withTimezone: true }),
  inviteExpiresAt: timestamp({ withTimezone: true }),
  ...timestamps,
});
