// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { availabilitySubmission } from '@/db/schema/availability';
import { evaluateInactivity } from '@/lib/inactivity';

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({
      from: () => ({ where: () => Object.assign(Promise.resolve([]), { limit: async () => [] }) }),
    }),
    transaction: mocks.transaction,
  },
}));
vi.mock('@/actions/auth-helpers', () => ({ ensureAdmin: async () => ({}), ensureAccess: vi.fn() }));
vi.mock('@/actions/games', () => ({
  isMonthScheduled: async () => ({ type: 'success', data: false }),
}));
vi.mock('@/lib/notifications', () => ({
  notifyAdmin: vi.fn(),
  generateStandardSimpleMessage: vi.fn(),
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { adminSubmitMemberAvailability, adminUpdateMemberAvailability } from '../availability';
import { saveAvailability } from '@/lib/save-availability';

let client: PGlite;
let database: PgliteDatabase;
beforeEach(async () => {
  client = new PGlite();
  database = drizzle(client, { casing: 'snake_case' });
  // Minimal pre-migration schema; no connection strings, network or real data.
  await client.exec(`
    CREATE TABLE availability_submissions (
      id text PRIMARY KEY, guild_id text NOT NULL, discord_user_id text NOT NULL,
      user_id text, year integer NOT NULL, month integer NOT NULL,
      completed_at timestamp, completion_source text,
      created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(),
      UNIQUE (guild_id, discord_user_id, year, month)
    );
    CREATE TABLE availability_days (
      id text PRIMARY KEY, submission_id text NOT NULL REFERENCES availability_submissions(id),
      day integer NOT NULL, status text NOT NULL, UNIQUE (submission_id, day)
    );
    CREATE TABLE inactivity_guild_tracking (guild_id text PRIMARY KEY);
  `);
  const migration = await readFile(
    new URL('../../../drizzle/0026_inactivity_provenance_and_census_ordering.sql', import.meta.url),
    'utf8',
  );
  await client.exec(migration);
  mocks.transaction.mockImplementation((callback) => database.transaction(callback));
}, 20000);
afterEach(async () => {
  await client?.close();
  vi.clearAllMocks();
});

async function submission() {
  return (await database.select().from(availabilitySubmission))[0];
}
async function evaluate() {
  const row = await submission();
  return evaluateInactivity({
    guildId: 'a',
    discordUserId: 'target',
    now: new Date('2028-02-25Z'),
    threshold: 3,
    sessionsPerMonth: 2,
    bot: false,
    access: true,
    joinedAt: '2025-01-01Z',
    tracking: {
      guildId: 'a',
      discordUserId: 'target',
      firstEligibleAt: new Date('2025-01-01Z'),
      additionSource: 'schedule_fallback',
      firstObservedAt: new Date('2025-01-01Z'),
      lastObservedAt: new Date(),
      hasAccess: true,
      accessSince: new Date('2025-01-01Z'),
      discordJoinedAt: '2025-01-01Z',
    },
    submissions: [row],
  });
}
const fullMonth = Array.from({ length: 29 }, (_, i) => ({
  day: i + 1,
  status: 'unavailable' as const,
}));

describe('PostgreSQL mixed-version completion provenance', () => {
  it('cannot redirect full-month day inserts to another guild through extra client fields', async () => {
    await client.exec(
      `INSERT INTO availability_submissions (id, guild_id, discord_user_id, year, month) VALUES ('victim', 'other-guild', 'other-member', 2028, 2)`,
    );
    const payload = fullMonth.map((day) => ({
      ...day,
      id: `injected-${day.day}`,
      submissionId: 'victim',
      guildId: 'other-guild',
    }));
    const saved = await saveAvailability({
      guildId: 'a',
      discordUserId: 'target',
      year: 2028,
      month: 2,
      days: payload,
      displayName: 'Player',
      userId: null,
    });
    const result = await client.query<{ submission_id: string; count: number }>(
      'SELECT submission_id, count(*)::integer AS count FROM availability_days GROUP BY submission_id',
    );
    expect(result.rows).toEqual([{ submission_id: saved.submissionId, count: 29 }]);
    expect(
      (await database.select().from(availabilitySubmission)).find((row) => row.id === 'victim')
        ?.completedAt,
    ).toBe(null);
  });
  it('keeps repeated new-version partial edits version-matched without declaring a full submission', async () => {
    expect((await adminUpdateMemberAvailability('a', 2028, 2, 'target', 1, 'available')).type).toBe(
      'success',
    );
    expect(await submission()).toMatchObject({
      writeVersion: 0,
      partialWriteVersion: 0,
      completedAt: null,
      completionSource: 'partial',
    });
    expect(
      (await adminUpdateMemberAvailability('a', 2028, 2, 'target', 2, 'unavailable')).type,
    ).toBe('success');
    expect(await submission()).toMatchObject({
      writeVersion: 1,
      partialWriteVersion: 1,
      completedAt: null,
    });
    expect((await evaluate()).classification).toBe('inactive');
  });
  it('a legacy full save invalidates partial evidence even with an identical timestamp; later partial edits cannot recertify it', async () => {
    await adminUpdateMemberAvailability('a', 2028, 2, 'target', 1, 'available');
    const before = await submission();
    // Simulate the old writer: update only old columns, then replace every day.
    await client.exec(`BEGIN;
      UPDATE availability_submissions SET updated_at = updated_at;
      DELETE FROM availability_days;
      INSERT INTO availability_days (id, submission_id, day, status)
        SELECT 'legacy-' || d, s.id, d, 'unavailable'
        FROM availability_submissions s CROSS JOIN generate_series(1,29) d;
      COMMIT;`);
    const legacy = await submission();
    expect(legacy.updatedAt).toEqual(before.updatedAt);
    expect(legacy).toMatchObject({
      writeVersion: 1,
      partialWriteVersion: 0,
      completedAt: null,
      completionSource: 'partial',
    });
    expect((await evaluate()).classification).toBe('active');
    await adminUpdateMemberAvailability('a', 2028, 2, 'target', 1, 'unset');
    expect(await submission()).toMatchObject({
      writeVersion: 2,
      partialWriteVersion: null,
      completedAt: null,
    });
    expect((await evaluate()).classification).toBe('active');
  });
  it('preserves established full admin completion through new partial and legacy updates', async () => {
    expect((await adminSubmitMemberAvailability('a', 2028, 2, 'target', fullMonth)).type).toBe(
      'success',
    );
    const completed = (await submission()).completedAt;
    await adminUpdateMemberAvailability('a', 2028, 2, 'target', 1, 'unset');
    await client.exec('UPDATE availability_submissions SET updated_at = updated_at');
    expect(await submission()).toMatchObject({ completedAt: completed, completionSource: 'admin' });
    expect((await evaluate()).classification).toBe('active');
  });
});
