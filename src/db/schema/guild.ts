import { pgTable, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

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
  inactivityEnabled: boolean().default(false).notNull(),
  inactivityThreshold: integer().default(3).notNull(),
  consentEnabled: boolean().default(false).notNull(),
  consentGuidance: text(),
  consentTopicsSeededAt: timestamp(),
});
