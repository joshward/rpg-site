import { db } from '@/db/db';
import { cache } from '@/db/schema/cache';
import { eq, gt, and, or, isNull, lt, like } from 'drizzle-orm';
import * as v from 'valibot';

type CacheKey = string | string[];

const normalizeKey = (key: CacheKey): string => {
  return Array.isArray(key) ? key.join(':') : key;
};

/**
 * Generic cache service using the database as a backend.
 */
export const cacheService = {
  /**
   * Retrieves a value from the cache, validates it with the provided schema,
   * or falls back to the fetcher if missing or invalid.
   */
  async wrap<TSchema extends v.BaseSchema<unknown, unknown, v.BaseIssue<unknown>>>(
    key: CacheKey,
    schema: TSchema,
    fetcher: () => Promise<v.InferOutput<TSchema>>,
    ttlSeconds?: number,
  ): Promise<v.InferOutput<TSchema>> {
    const normalizedKey = normalizeKey(key);
    const cachedValue = await this.get(normalizedKey);

    if (cachedValue !== null) {
      const result = v.safeParse(schema, cachedValue);
      if (result.success) {
        return result.output;
      }
      console.warn(`Cache value for key '${normalizedKey}' failed validation, refetching`);
    }

    const freshValue = await fetcher();
    await this.set(normalizedKey, freshValue, ttlSeconds);
    return freshValue;
  },

  /**
   * Retrieves a value from the cache.
   * Returns null if the key doesn't exist or has expired.
   */
  async get(key: CacheKey): Promise<unknown | null> {
    const normalizedKey = normalizeKey(key);
    const now = new Date();
    const results = await db
      .select()
      .from(cache)
      .where(
        and(eq(cache.key, normalizedKey), or(isNull(cache.expiresAt), gt(cache.expiresAt, now))),
      )
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return results[0].value;
  },

  /**
   * Sets a value in the cache with an optional TTL (in seconds).
   */
  async set(key: CacheKey, value: unknown, ttlSeconds?: number): Promise<void> {
    const normalizedKey = normalizeKey(key);
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    await db
      .insert(cache)
      .values({
        key: normalizedKey,
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
  async delete(key: CacheKey): Promise<void> {
    const normalizedKey = normalizeKey(key);
    await db.delete(cache).where(eq(cache.key, normalizedKey));
  },

  /**
   * Deletes all keys starting with the provided prefix.
   */
  async deletePrefix(prefix: CacheKey): Promise<void> {
    const normalizedPrefix = normalizeKey(prefix);
    await db.delete(cache).where(like(cache.key, `${normalizedPrefix}:%`));
  },

  /**
   * Removes all expired entries from the cache.
   */
  async clearExpired(): Promise<void> {
    const now = new Date();
    await db.delete(cache).where(lt(cache.expiresAt, now));
  },
};
