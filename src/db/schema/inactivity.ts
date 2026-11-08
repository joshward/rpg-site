import { pgTable, text, timestamp, integer } from 'drizzle-orm/pg-core';
import { guild } from './guild';

// Append-only human evidence reviews. Never derive original eligibility from preference timestamps.
export const inactivityReview = pgTable('inactivity_reviews', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  guildId: text()
    .notNull()
    .references(() => guild.id, { onDelete: 'cascade' }),
  discordUserId: text().notNull(),
  originalAddedAt: timestamp().notNull(),
  reliableFrom: integer().notNull(),
  reliableThrough: integer().notNull(),
  discordJoinedAt: text().notNull(),
  evidence: text().notNull(),
  reviewedBy: text().notNull(),
  reviewedAt: timestamp().defaultNow().notNull(),
});
