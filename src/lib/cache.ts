import { db } from '@/db/db';
import { cache } from '@/db/schema/cache';
import { eq, gt, and, or, isNull, lt } from 'drizzle-orm';
import * as v from 'valibot';

/**
 * Generic cache service using the database as a backend.
 */
export const cacheService = {
  /**
   * Retrieves a value from the cache, validates it with the provided schema,
   * or falls back to the fetcher if missing or invalid.
   */
  async wrap<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    key: string,
    schema: TSchema,
    fetcher: () => Promise<v.InferOutput<TSchema>>,
    ttlSeconds?: number,
  ): Promise<v.InferOutput<TSchema>> {
    const cachedValue = await this.get(key);

    if (cachedValue !== null) {
      const result = v.safeParse(schema, cachedValue);
      if (result.success) {
        return result.output;
      }
    }

    const freshValue = await fetcher();
    await this.set(key, freshValue, ttlSeconds);
    return freshValue;
  },

  /**
   * Retrieves a value from the cache.
   * Returns null if the key doesn't exist or has expired.
   */
  async get(key: string): Promise<unknown | null> {
    const now = new Date();
    const results = await db
      .select()
      .from(cache)
      .where(and(eq(cache.key, key), or(isNull(cache.expiresAt), gt(cache.expiresAt, now))))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results[0].value;
  },

  /**
   * Sets a value in the cache with an optional TTL (in seconds).
   */
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    await db
      .insert(cache)
      .values({
        key,
        value,
        expiresAt,
      })
      .onConflictDoUpdate({
        target: cache.key,
        set: {
          value,
          expiresAt,
          createdAt: new Date(),
        },
      });
  },

  /**
   * Deletes a key from the cache.
   */
  async delete(key: string): Promise<void> {
    await db.delete(cache).where(eq(cache.key, key));
  },

  /**
   * Removes all expired entries from the cache.
   */
  async clearExpired(): Promise<void> {
    const now = new Date();
    await db.delete(cache).where(lt(cache.expiresAt, now));
  },
};
