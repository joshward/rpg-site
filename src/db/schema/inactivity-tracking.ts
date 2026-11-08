import { pgTable, text, timestamp, boolean, primaryKey } from 'drizzle-orm/pg-core';
import { guild } from './guild';

export const inactivityGuildTracking = pgTable('inactivity_guild_tracking', {
  guildId: text()
    .primaryKey()
    .references(() => guild.id, { onDelete: 'cascade' }),
  initializedAt: timestamp().notNull(),
  lastCensusStartedAt: timestamp(),
  scheduleFallbackAt: timestamp(),
});

export const inactivityMemberTracking = pgTable(
  'inactivity_member_tracking',
  {
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    discordUserId: text().notNull(),
    firstEligibleAt: timestamp().notNull(),
    additionSource: text({ enum: ['schedule_fallback', 'first_observed'] }).notNull(),
    firstObservedAt: timestamp().notNull(),
    lastObservedAt: timestamp().notNull(),
    hasAccess: boolean().notNull(),
    accessSince: timestamp().notNull(),
    discordJoinedAt: text(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.discordUserId] })],
);
