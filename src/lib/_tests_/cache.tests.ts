import { describe, expect, it, vi, beforeEach } from 'vitest';
import { cacheService } from '../cache';
import { db } from '@/db/db';
import { cache } from '@/db/schema/cache';
import * as v from 'valibot';

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
  },
}));

describe('cacheService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('wrap', () => {
    const schema = v.object({ foo: v.string() });
    const key = 'test-key';

    it('returns cached value if valid', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ key, value: { foo: 'bar' } }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);
      const fetcher = vi.fn();

      const result = await cacheService.wrap(key, schema, fetcher);

      expect(result).toEqual({ foo: 'bar' });
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('calls fetcher and updates cache if cache miss', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as any);

      const fetcher = vi.fn().mockResolvedValue({ foo: 'fresh' });

      const result = await cacheService.wrap(key, schema, fetcher);

      expect(result).toEqual({ foo: 'fresh' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(db.insert).toHaveBeenCalledWith(cache);
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          key,
          value: { foo: 'fresh' },
        }),
      );
    });

    it('calls fetcher and updates cache if cached value is invalid', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ key, value: { wrong: 'data' } }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as any);

      const fetcher = vi.fn().mockResolvedValue({ foo: 'recovered' });

      const result = await cacheService.wrap(key, schema, fetcher);

      expect(result).toEqual({ foo: 'recovered' });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          value: { foo: 'recovered' },
        }),
      );
    });
  });

  describe('get', () => {
    it('returns null when no entry is found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await cacheService.get('test-key');
      expect(result).toBeNull();
    });

    it('returns value when valid entry is found', async () => {
      const mockSelect = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([{ key: 'test-key', value: { foo: 'bar' } }]),
      };
      vi.mocked(db.select).mockReturnValue(mockSelect as any);

      const result = await cacheService.get('test-key');
      expect(result).toEqual({ foo: 'bar' });
    });
  });

  describe('set', () => {
    it('inserts or updates the cache entry', async () => {
      const mockInsert = {
        values: vi.fn().mockReturnThis(),
        onConflictDoUpdate: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(db.insert).mockReturnValue(mockInsert as any);

      await cacheService.set('test-key', { baz: 'qux' }, 3600);

      expect(db.insert).toHaveBeenCalledWith(cache);
      expect(mockInsert.values).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'test-key',
          value: { baz: 'qux' },
          expiresAt: expect.any(Date),
        }),
      );
    });
  });

  describe('delete', () => {
    it('deletes the entry by key', async () => {
      const mockDelete = {
        where: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(db.delete).mockReturnValue(mockDelete as any);

      await cacheService.delete('test-key');

      expect(db.delete).toHaveBeenCalledWith(cache);
    });
  });
});
