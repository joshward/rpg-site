import { pgTable, text, integer, timestamp, index, unique, foreignKey } from 'drizzle-orm/pg-core';
import { guild } from './guild';

// Official topics have no owner. A player-created unofficial topic has an
// ownerDiscordUserId; answers in a later slice can refer to either by ID.
export const consentTopic = pgTable(
  'consent_topics',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    parentTopicId: text(),
    ownerDiscordUserId: text(),
    name: text().notNull(),
    sortOrder: integer().default(0).notNull(),
    createdAt: timestamp().defaultNow().notNull(),
  },
  (table) => [
    unique('consent_topics_guild_id_id_unique').on(table.guildId, table.id),
    foreignKey({
      columns: [table.guildId, table.parentTopicId],
      foreignColumns: [table.guildId, table.id],
      name: 'consent_topics_parent_same_guild_fk',
    }).onDelete('cascade'),
    index('consent_topics_guild_idx').on(table.guildId),
  ],
);
