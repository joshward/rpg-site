import { pgTable, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { guild } from './guild';
import { user } from './auth';

export const memberPreference = pgTable(
  'member_preferences',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    discordUserId: text().notNull(),
    userId: text().references(() => user.id, { onDelete: 'cascade' }),
    sessionsPerMonth: integer(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.guildId, table.discordUserId)],
);
