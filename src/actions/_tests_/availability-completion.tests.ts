import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  admin: vi.fn(),
  select: vi.fn(),
  transaction: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  notify: vi.fn(),
  revalidate: vi.fn(),
  scheduled: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/actions/auth-helpers', () => ({ ensureAccess: mocks.access, ensureAdmin: mocks.admin }));
vi.mock('@/db/db', () => ({ db: { select: mocks.select, transaction: mocks.transaction } }));
vi.mock('@/actions/games', () => ({ isMonthScheduled: mocks.scheduled }));
vi.mock('@/lib/notifications', () => ({
  notifyAdmin: mocks.notify,
  generateStandardSimpleMessage: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
import {
  submitAvailability,
  adminSubmitMemberAvailability,
  adminUpdateMemberAvailability,
} from '../availability';
import { saveAvailability } from '@/lib/save-availability';

const values: Record<string, unknown>[] = [];
const updates: Record<string, unknown>[] = [];
function days(count: number) {
  return Array.from({ length: count }, (_, i) => ({ day: i + 1, status: 'unavailable' as const }));
}

beforeEach(() => {
  vi.resetAllMocks();
  values.length = 0;
  updates.length = 0;
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2028-02-25T00:00:00Z'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.access.mockResolvedValue({
    session: { user: { id: 'user', name: 'Player' } },
    discordAccount: { userId: 'discord-user' },
    isImpersonating: false,
  });
  mocks.admin.mockResolvedValue({});
  mocks.scheduled.mockResolvedValue({ type: 'success', data: false });
  mocks.select.mockReturnValue({
    from: () => ({ where: () => Object.assign(Promise.resolve([]), { limit: async () => [] }) }),
  });
  mocks.insert.mockReturnValue({
    values: (value: Record<string, unknown>) => {
      values.push(value);
      return {
        onConflictDoUpdate: (options: { set: Record<string, unknown> }) => {
          updates.push(options.set);
          return { returning: async () => [{ id: 'submission' }] };
        },
      };
    },
  });
  mocks.update.mockReturnValue({
    set: (value: Record<string, unknown>) => {
      updates.push(value);
      return { where: async () => {} };
    },
  });
  mocks.transaction.mockImplementation(async (callback) =>
    callback({
      insert: mocks.insert,
      update: mocks.update,
      delete: () => ({ where: async () => {} }),
    }),
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('durable full completion provenance', () => {
  it('records full all-unavailable player completion atomically with the days', async () => {
    expect((await submitAvailability('guild-a', 2028, 2, days(29))).type).toBe('success');
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(values[0]).toMatchObject({
      guildId: 'guild-a',
      discordUserId: 'discord-user',
      completedAt: expect.any(Date),
      completionSource: 'player',
    });
    expect(updates[0]).toMatchObject({ completedAt: expect.any(Date), completionSource: 'player' });
  });
  it.each(['player', 'admin', 'discord'])(
    'strips injected day identifiers on the %s full-save path',
    async (path) => {
      const payload = days(29).map((day) => ({
        ...day,
        id: 'attacker-chosen-id',
        submissionId: 'victim-submission-in-another-guild',
        guildId: 'guild-b',
        discordUserId: 'victim',
      }));
      if (path === 'player')
        expect((await submitAvailability('guild-a', 2028, 2, payload)).type).toBe('success');
      else if (path === 'admin')
        expect(
          (await adminSubmitMemberAvailability('guild-a', 2028, 2, 'target', payload)).type,
        ).toBe('success');
      else
        await saveAvailability({
          guildId: 'guild-a',
          discordUserId: 'target',
          year: 2028,
          month: 2,
          days: payload,
          displayName: 'Player',
          userId: null,
        });
      const savedDays = values[1] as unknown as Record<string, unknown>[];
      expect(savedDays).toHaveLength(29);
      expect(
        savedDays.every(
          (day, index) =>
            day.submissionId === 'submission' &&
            day.day === index + 1 &&
            day.status === 'unavailable',
        ),
      ).toBe(true);
      for (const day of savedDays)
        expect(Object.keys(day).sort()).toEqual(['day', 'status', 'submissionId']);
    },
  );
  it('records full admin completion in the same transaction', async () => {
    expect((await adminSubmitMemberAvailability('guild-a', 2028, 2, 'target', days(29))).type).toBe(
      'success',
    );
    expect(mocks.admin).toHaveBeenCalledWith('guild-a');
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(values[0]).toMatchObject({
      guildId: 'guild-a',
      discordUserId: 'target',
      year: 2028,
      month: 2,
    });
    expect(updates.at(-1)).toMatchObject({
      completedAt: expect.any(Date),
      completionSource: 'admin',
    });
  });
  it('identifies an impersonated full submission as admin rather than player activity', async () => {
    mocks.access.mockResolvedValue({
      session: { user: { id: 'user' } },
      discordAccount: { userId: 'discord-user' },
      isImpersonating: true,
    });
    await submitAvailability('guild-a', 2028, 2, days(29));
    expect(values[0].completionSource).toBe('admin');
  });
  it.each(['available', 'unset'] as const)(
    'partial admin %s does not establish or erase completion',
    async (status) => {
      expect(
        (await adminUpdateMemberAvailability('guild-a', 2028, 2, 'target', 1, status)).type,
      ).toBe('success');
      expect(values[0]).toHaveProperty('completionSource', 'partial');
      expect(values[0]).toHaveProperty('partialWriteVersion', 0);
      const marker = new PgDialect({ casing: 'snake_case' }).sqlToQuery(
        updates[0].partialWriteVersion as Parameters<PgDialect['sqlToQuery']>[0],
      );
      expect(marker.sql).toContain(
        '"partial_write_version" = "availability_submissions"."write_version"',
      );
      expect(marker.sql).toContain('"write_version" + 1 else null end');
      expect(mocks.update).not.toHaveBeenCalled();
      for (const record of [...values, ...updates])
        expect(record).not.toHaveProperty('completedAt');
      // Conflict/update paths must not overwrite full completion or unknown legacy provenance.
      for (const record of updates) expect(record).not.toHaveProperty('completionSource');
    },
  );
  it('requires every real leap-month day before recording completion', async () => {
    expect((await submitAvailability('guild-a', 2028, 2, days(28))).type).toBe('failure');
    expect((await adminSubmitMemberAvailability('guild-a', 2028, 2, 'target', days(28))).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('validates the internal Discord full-submit path too', async () => {
    await saveAvailability({
      guildId: 'guild-a',
      discordUserId: 'target',
      year: 2028,
      month: 2,
      days: days(29),
      displayName: 'Player',
      userId: null,
    });
    expect(values[0].completionSource).toBe('player');
    mocks.transaction.mockClear();
    await expect(
      saveAvailability({
        guildId: 'guild-a',
        discordUserId: 'target',
        year: 2028,
        month: 2,
        days: days(28),
        displayName: 'Player',
      }),
    ).rejects.toThrow('full valid');
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects full submissions without authorization before persisting completion', async () => {
    mocks.access.mockRejectedValue(new Error('Forbidden'));
    mocks.admin.mockRejectedValue(new Error('Forbidden'));
    expect((await submitAvailability('guild-b', 2028, 2, days(29))).type).toBe('failure');
    expect((await adminSubmitMemberAvailability('guild-b', 2028, 2, 'target', days(29))).type).toBe(
      'failure',
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
