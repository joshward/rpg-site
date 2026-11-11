import { pgTable, text, integer, timestamp, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { guild } from './guild';

// Immutable per-cycle provenance. A voluntary zero never creates this record.
export const inactivityPause = pgTable(
  'inactivity_pauses',
  {
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    discordUserId: text().notNull(),
    targetMonth: text().notNull(),
    previousSessionsPerMonth: integer().notNull(),
    pausedAt: timestamp().defaultNow().notNull(),
    threshold: integer().notNull(),
    evidence: jsonb().notNull(),
    // Reserve the single attempt in the same transaction as zeroing. A crash
    // leaves an unknown outcome, never an automatically resent explanation.
    dmStatus: text({ enum: ['reserved', 'sent', 'failed', 'blocked'] }).notNull(),
    dmFinishedAt: timestamp(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.discordUserId, table.targetMonth] })],
);
