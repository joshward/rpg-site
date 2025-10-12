import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core';

export const user = pgTable('users', {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().default(false).notNull(),
  image: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const session = pgTable('sessions', {
  id: text().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
});

export const account = pgTable('accounts', {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const verification = pgTable('verifications', {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  createdAt: timestamp().defaultNow().notNull(),
  updatedAt: timestamp()
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});
