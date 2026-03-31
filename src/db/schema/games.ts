import { pgTable, text, integer, timestamp, boolean, unique } from 'drizzle-orm/pg-core';
import { guild } from './guild';

export const gameStatusEnum = ['draft', 'active', 'paused', 'archived'] as const;
export type GameStatus = (typeof gameStatusEnum)[number];

export const game = pgTable('games', {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  guildId: text()
    .notNull()
    .references(() => guild.id, { onDelete: 'cascade' }),
  name: text().notNull(),
  description: text(),
  status: text({ enum: gameStatusEnum }).default('draft').notNull(),
  sessionsPerMonth: integer().default(0).notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const gameMember = pgTable(
  'game_members',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text()
      .notNull()
      .references(() => game.id, { onDelete: 'cascade' }),
    discordUserId: text().notNull(),
    isRequired: boolean().default(true).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [unique().on(table.gameId, table.discordUserId)],
);
