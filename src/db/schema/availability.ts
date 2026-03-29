import { pgTable, text, integer, timestamp, unique } from 'drizzle-orm/pg-core';
import { guild } from './guild';
import { user } from './auth';

export const availabilitySubmission = pgTable(
  'availability_submissions',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    guildId: text()
      .notNull()
      .references(() => guild.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    year: integer().notNull(),
    month: integer().notNull(),
    createdAt: timestamp().defaultNow().notNull(),
    updatedAt: timestamp()
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [unique().on(table.guildId, table.userId, table.year, table.month)],
);

export const availabilityDay = pgTable(
  'availability_days',
  {
    id: text()
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    submissionId: text()
      .notNull()
      .references(() => availabilitySubmission.id, { onDelete: 'cascade' }),
    day: integer().notNull(),
    status: text({ enum: ['available', 'late', 'if_needed', 'unavailable'] }).notNull(),
  },
  (table) => [unique().on(table.submissionId, table.day)],
);
