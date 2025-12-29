import { pgTable, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const cache = pgTable('cache', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  expiresAt: timestamp(),
  createdAt: timestamp().defaultNow().notNull(),
});
