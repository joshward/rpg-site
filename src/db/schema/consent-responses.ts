import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  foreignKey,
  index,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { guild } from './guild';
import { consentTopic } from './consent-topics';

export const consentAnswerChoices = ['enthusiastic', 'veil', 'line'] as const;
export type ConsentAnswer = (typeof consentAnswerChoices)[number];

// A guild member owns one response per topic. A null answer may still carry a
// private note; deleting the topic cascades to its responses (including notes).
export const consentResponse = pgTable(
  'consent_responses',
  {
    guildId: text().notNull(),
    discordUserId: text().notNull(),
    topicId: text().notNull(),
    answer: text({ enum: consentAnswerChoices }),
    headsUp: boolean().default(false).notNull(),
    note: text(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.guildId, table.discordUserId, table.topicId] }),
    foreignKey({
      columns: [table.guildId, table.topicId],
      foreignColumns: [consentTopic.guildId, consentTopic.id],
      name: 'consent_responses_topic_same_guild_fk',
    }).onDelete('cascade'),
    index('consent_responses_guild_topic_idx').on(table.guildId, table.topicId),
    check(
      'consent_responses_answer_check',
      sql`${table.answer} IS NULL OR ${table.answer} IN ('enthusiastic', 'veil', 'line')`,
    ),
    check(
      'consent_responses_heads_up_check',
      sql`NOT ${table.headsUp} OR (${table.answer} IS NOT NULL AND ${table.answer} IN ('enthusiastic', 'veil'))`,
    ),
  ],
);

// Overall private notes are separate from per-topic responses so a player can
// save one without answering anything. No row represents an empty note.
export const consentChecklist = pgTable(
  'consent_checklists',
  {
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    discordUserId: text().notNull(),
    overallNote: text().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [primaryKey({ columns: [table.guildId, table.discordUserId] })],
);
