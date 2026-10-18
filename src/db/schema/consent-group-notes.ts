import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { game } from './games';
import { consentTopic } from './consent-topics';

// Blank notes are retained as revisioned tombstones, preventing an old editor
// from overwriting a later clear/recreate cycle. These are group-facing notes,
// never private player notes or coordinator assignments.
export const gameConsentGroupNote = pgTable(
  'game_consent_group_notes',
  {
    gameId: text().primaryKey(),
    guildId: text().notNull(),
    note: text().default('').notNull(),
    revision: integer().default(1).notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.guildId, table.gameId],
      foreignColumns: [game.guildId, game.id],
      name: 'game_consent_group_notes_game_same_guild_fk',
    }).onDelete('cascade'),
    check('game_consent_group_notes_revision_check', sql`${table.revision} > 0`),
  ],
);

export const gameConsentTopicGroupNote = pgTable(
  'game_consent_topic_group_notes',
  {
    gameId: text().notNull(),
    topicId: text().notNull(),
    guildId: text().notNull(),
    note: text().default('').notNull(),
    revision: integer().default(1).notNull(),
    updatedAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.gameId, table.topicId] }),
    foreignKey({
      columns: [table.guildId, table.gameId],
      foreignColumns: [game.guildId, game.id],
      name: 'game_consent_topic_notes_game_same_guild_fk',
    }).onDelete('cascade'),
    foreignKey({
      columns: [table.guildId, table.topicId],
      foreignColumns: [consentTopic.guildId, consentTopic.id],
      name: 'game_consent_topic_notes_topic_same_guild_fk',
    }).onDelete('cascade'),
    check('game_consent_topic_group_notes_revision_check', sql`${table.revision} > 0`),
  ],
);
