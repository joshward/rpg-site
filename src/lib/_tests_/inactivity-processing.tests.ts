// @vitest-environment node
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type PgliteDatabase } from 'drizzle-orm/pglite';
import { readFile } from 'node:fs/promises';
import { guild } from '@/db/schema/guild';
import { memberPreference } from '@/db/schema/member-preferences';
import { inactivityMemberTracking } from '@/db/schema/inactivity-tracking';
import { availabilitySubmission } from '@/db/schema/availability';
import { inactivityPause } from '@/db/schema/inactivity-pauses';

const mocks = vi.hoisted(() => ({
  db: null as unknown as PgliteDatabase,
  sync: vi.fn(),
  member: vi.fn(),
  roles: vi.fn(),
  dm: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/db/db', () => ({
  get db() {
    return mocks.db;
  },
}));
vi.mock('@/lib/inactivity-tracking', () => ({ syncGuildInactivityTracking: mocks.sync }));
vi.mock('@/lib/discord/api', () => ({ getGuildMember: mocks.member, getGuildRoles: mocks.roles }));
vi.mock('@/lib/notifications/dm', () => ({ sendDM: mocks.dm }));
vi.mock('@/lib/authn', () => ({
  resolveRoleWithGuildRoles: (roles: string[]) => (roles.includes('allowed') ? 'member' : 'none'),
}));
import { processGuildInactivity } from '../inactivity-processing';

let client: PGlite;
const now = new Date('2028-04-26T18:00:00Z');
const joinedAt = '2025-01-01T00:00:00Z';
const run = (date = now, id = 'a') =>
  processGuildInactivity(id, date, 'https://example.test/availability');
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
  vi.stubEnv('INACTIVITY_AUTOMATION_ENABLED', 'true');
  client = new PGlite();
  mocks.db = drizzle(client, { casing: 'snake_case' });
  await client.exec(`
    CREATE TABLE guilds (id text PRIMARY KEY, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL,
      allowed_roles text[] NOT NULL, support_channel_id text, support_channel_name text, admin_contact_info text,
      admin_notification_channel_id text, admin_notification_channel_name text, global_notification_channel_id text,
      global_notification_channel_name text, overview_text text, default_scheduling_details text,
      inactivity_enabled boolean DEFAULT false NOT NULL, inactivity_threshold integer DEFAULT 3 NOT NULL,
      consent_enabled boolean DEFAULT false NOT NULL, consent_guidance text, consent_topics_seeded_at timestamp);
    CREATE TABLE member_preferences (id text PRIMARY KEY, guild_id text NOT NULL, discord_user_id text NOT NULL, user_id text,
      sessions_per_month integer, created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL,
      UNIQUE(guild_id, discord_user_id));
    CREATE TABLE availability_submissions (id text PRIMARY KEY, guild_id text NOT NULL, discord_user_id text NOT NULL, user_id text,
      year integer NOT NULL, month integer NOT NULL, completed_at timestamp, completion_source text,
      write_version integer DEFAULT 0 NOT NULL, partial_write_version integer,
      created_at timestamp DEFAULT now() NOT NULL, updated_at timestamp DEFAULT now() NOT NULL);
  `);
  for (const file of ['0024_inactivity_membership_tracking.sql', '0027_inactivity_pauses.sql']) {
    await client.exec(await readFile(new URL(`../../../drizzle/${file}`, import.meta.url), 'utf8'));
  }
  await mocks.db.insert(guild).values([
    { id: 'a', allowedRoles: ['allowed'], inactivityEnabled: true },
    { id: 'b', allowedRoles: ['allowed'], inactivityEnabled: true },
  ]);
  await mocks.db
    .insert(memberPreference)
    .values({ id: 'pref', guildId: 'a', discordUserId: 'player', sessionsPerMonth: -1 });
  await mocks.db.insert(inactivityMemberTracking).values({
    guildId: 'a',
    discordUserId: 'player',
    firstEligibleAt: new Date(joinedAt),
    additionSource: 'schedule_fallback',
    firstObservedAt: new Date(joinedAt),
    lastObservedAt: now,
    hasAccess: true,
    accessSince: new Date(joinedAt),
    discordJoinedAt: joinedAt,
  });
  mocks.sync.mockResolvedValue({ observations: [{ discordUserId: 'player', eligible: true }] });
  mocks.member.mockResolvedValue({
    user: { id: 'player', username: 'Player', bot: false },
    roles: ['allowed'],
    joined_at: joinedAt,
  });
  mocks.roles.mockResolvedValue([]);
  mocks.dm.mockResolvedValue(true);
}, 20000);
afterEach(async () => {
  await client?.close();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
const preference = async () => (await mocks.db.select().from(memberPreference))[0].sessionsPerMonth;
const audits = () => mocks.db.select().from(inactivityPause);

describe('inactivity mutation and single-attempt persistence', () => {
  it('pauses a longstanding never-submitted No Limit player on the first cycle, recording evidence', async () => {
    expect(await run()).toEqual(new Set(['player']));
    expect(await preference()).toBe(0);
    expect(await audits()).toEqual([
      expect.objectContaining({
        guildId: 'a',
        targetMonth: '2028-05',
        previousSessionsPerMonth: -1,
        threshold: 3,
        dmStatus: 'sent',
      }),
    ]);
    expect(mocks.dm).toHaveBeenCalledOnce();
    expect(JSON.stringify(mocks.dm.mock.calls[0][2])).toContain(
      'I’ve set your desired sessions to **0**',
    );
    expect(JSON.stringify(mocks.dm.mock.calls[0][2])).not.toContain('two months');
  });
  it('reserves a single explanation, including failed DMs and same-cycle restoration', async () => {
    mocks.dm.mockResolvedValue(false);
    await run();
    await mocks.db.update(memberPreference).set({ sessionsPerMonth: 2 });
    expect(await run()).toEqual(new Set(['player']));
    expect(await preference()).toBe(2);
    expect(mocks.dm).toHaveBeenCalledOnce();
    expect((await audits())[0].dmStatus).toBe('failed');
  });
  it('can pause restored preferences again in a later eligible cycle', async () => {
    await run();
    await mocks.db.update(memberPreference).set({ sessionsPerMonth: 2 });
    const later = new Date('2028-05-27T18:00:00Z');
    vi.setSystemTime(later);
    await run(later);
    expect(await preference()).toBe(0);
    expect(await audits()).toHaveLength(2);
    expect(mocks.dm).toHaveBeenCalledTimes(2);
  });
  it.each([3, 4, 5])(
    'protects a full completion for checked month %i, even if written during census',
    async (month) => {
      mocks.sync.mockImplementationOnce(async () => {
        await mocks.db.insert(availabilitySubmission).values({
          guildId: 'a',
          discordUserId: 'player',
          year: 2028,
          month,
          completedAt: now,
          completionSource: 'admin',
        });
        return { observations: [{ discordUserId: 'player', eligible: true }] };
      });
      await run();
      expect(await preference()).toBe(-1);
      expect(await audits()).toHaveLength(0);
      expect(mocks.dm).not.toHaveBeenCalled();
    },
  );
  it('protects a restored preference with a new completion in the later cycle', async () => {
    await run();
    await mocks.db.update(memberPreference).set({ sessionsPerMonth: 2 });
    await mocks.db.insert(availabilitySubmission).values({
      guildId: 'a',
      discordUserId: 'player',
      year: 2028,
      month: 5,
      completedAt: now,
      completionSource: 'player',
    });
    const later = new Date('2028-05-27T18:00:00Z');
    vi.setSystemTime(later);
    await run(later);
    expect(await preference()).toBe(2);
    expect(await audits()).toHaveLength(1);
  });
  it('never resends a reserved attempt whose delivery outcome is unknown', async () => {
    await run();
    await mocks.db.update(inactivityPause).set({ dmStatus: 'reserved', dmFinishedAt: null });
    await run();
    expect(mocks.dm).toHaveBeenCalledOnce();
  });
  it('rolls back the audit and preference together if zeroing fails', async () => {
    await client.exec(`CREATE FUNCTION reject_zero() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test failure'; END $$;
      CREATE TRIGGER reject_zero BEFORE UPDATE ON member_preferences FOR EACH ROW EXECUTE FUNCTION reject_zero();`);
    await expect(run()).rejects.toThrow();
    expect(await audits()).toHaveLength(0);
    expect(await preference()).toBe(-1);
    expect(mocks.dm).not.toHaveBeenCalled();
  });
  it('does not treat another guild completion as protection or mutate another guild', async () => {
    await mocks.db.insert(availabilitySubmission).values({
      guildId: 'b',
      discordUserId: 'player',
      year: 2028,
      month: 5,
      completedAt: now,
      completionSource: 'player',
    });
    await run(now, 'b');
    expect(await preference()).toBe(-1);
    await run();
    expect(await preference()).toBe(0);
  });
  it.each([null, 0])(
    'rechecks a changed preference (%s) instead of using stale candidate data',
    async (value) => {
      mocks.sync.mockImplementationOnce(async () => {
        await mocks.db.update(memberPreference).set({ sessionsPerMonth: value });
        return { observations: [{ discordUserId: 'player', eligible: true }] };
      });
      await run();
      expect(await preference()).toBe(value);
      expect(mocks.dm).not.toHaveBeenCalled();
    },
  );
  it('fails closed when fresh access was lost', async () => {
    mocks.member.mockResolvedValue({ user: { bot: false }, roles: [], joined_at: joinedAt });
    await run();
    expect(await preference()).toBe(-1);
    expect(mocks.dm).not.toHaveBeenCalled();
  });
  it('protects ambiguous legacy responses', async () => {
    await mocks.db
      .insert(availabilitySubmission)
      .values({ guildId: 'a', discordUserId: 'player', year: 2028, month: 4 });
    await run();
    expect(await preference()).toBe(-1);
  });
  it('requires both explicit rollout opt-in and the guild flag', async () => {
    vi.stubEnv('INACTIVITY_AUTOMATION_ENABLED', 'false');
    await run();
    vi.stubEnv('INACTIVITY_AUTOMATION_ENABLED', 'true');
    await mocks.db.update(guild).set({ inactivityEnabled: false });
    await run();
    expect(await preference()).toBe(-1);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
  it('only runs at real UTC T-4, not T-7, T-2 or an overridden date', async () => {
    for (const day of [23, 25, 27, 28]) await run(new Date(`2028-04-${day}T18:00:00Z`));
    await run(new Date('2028-05-27T18:00:00Z'));
    expect(await preference()).toBe(-1);
    expect(mocks.sync).not.toHaveBeenCalled();
  });
});
