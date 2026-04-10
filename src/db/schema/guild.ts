import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const guild = pgTable('guilds', {
  id: text().primaryKey(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  allowedRoles: text().array().notNull(),
  supportChannelId: text(),
  supportChannelName: text(),
  adminContactInfo: text(),
  adminNotificationChannelId: text(),
  adminNotificationChannelName: text(),
  globalNotificationChannelId: text(),
  globalNotificationChannelName: text(),
  overviewText: text(),
  defaultSchedulingDetails: text(),
});
