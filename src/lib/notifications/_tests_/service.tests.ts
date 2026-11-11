import { describe, expect, it, vi, beforeEach } from 'vitest';
import { processGameReminders, processNotifications } from '../service';
import { processGuildInactivity } from '@/lib/inactivity-processing';
import { getPlayerCohorts } from '../cohorts';
import { getDaysUntilEndOfMonth } from '../utils';
import { getGuilds } from '@/lib/discord/api';
import {
  sendT7Reminder,
  sendT4CoreReminder,
  sendT4OptionalReminder,
  sendT2FinalCall,
} from '../dm-actions';

vi.mock('@/lib/inactivity-processing', () => ({ processGuildInactivity: vi.fn() }));
vi.mock('../cohorts', () => ({ getPlayerCohorts: vi.fn() }));
vi.mock('../dm-actions', () => ({
  sendT7Reminder: vi.fn(),
  sendT4CoreReminder: vi.fn(),
  sendT4OptionalReminder: vi.fn(),
  sendT2FinalCall: vi.fn(),
}));
import { db } from '@/db/db';
import { sendDiscordMessage } from '@/lib/discord/api';

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
  },
}));

vi.mock('@/lib/discord/api', () => ({
  sendDiscordMessage: vi.fn(),
  getGuilds: vi.fn(),
}));

vi.mock('../utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../utils')>()),
  getDaysUntilEndOfMonth: vi.fn(),
  getPrefix: vi.fn(() => ''),
}));

describe('availability reminder integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const gameQuery = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };
    vi.mocked(db.select).mockReturnValue(gameQuery as never);
    // Game reminder queries run first, then the configured-guild query.
    vi.mocked(db.select)
      .mockReturnValueOnce(gameQuery as never)
      .mockReturnValueOnce(gameQuery as never)
      .mockReturnValueOnce({ from: async () => [{ id: 'a', allowedRoles: ['member'] }] } as never);
    vi.mocked(getGuilds).mockResolvedValue([{ id: 'a', name: 'Server' }] as never);
    const player = (id: string) => ({ user: { id, username: id } });
    vi.mocked(getPlayerCohorts).mockResolvedValue({
      corePlayers: [player('paused'), player('core')],
      optionalPlayers: [player('optional')],
      missingCore: [player('paused'), player('core')],
      missingOptional: [player('optional')],
      submittedUserIds: new Set(),
    });
    vi.mocked(processGuildInactivity).mockResolvedValue(new Set(['paused']));
  });

  it('replaces T-4 reminders for processed players rather than adding to them', async () => {
    vi.mocked(getDaysUntilEndOfMonth).mockReturnValue(4);
    await processNotifications(new Date('2028-04-26T18:00:00Z'));
    expect(processGuildInactivity).toHaveBeenCalledOnce();
    expect(vi.mocked(processGuildInactivity).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(getPlayerCohorts).mock.invocationCallOrder[0],
    );
    expect(sendT4CoreReminder).toHaveBeenCalledOnce();
    expect(sendT4CoreReminder).toHaveBeenCalledWith('core', 'core', expect.anything());
    expect(sendT4OptionalReminder).toHaveBeenCalledWith('optional', 'optional', expect.anything());
  });

  it('leaves required-player T-7 unchanged', async () => {
    vi.mocked(getDaysUntilEndOfMonth).mockReturnValue(7);
    await processNotifications(new Date('2028-04-23T18:00:00Z'));
    expect(processGuildInactivity).not.toHaveBeenCalled();
    expect(sendT7Reminder).toHaveBeenCalledTimes(2);
  });

  it('uses the fresh T-2 cohort without running zeroing', async () => {
    vi.mocked(getDaysUntilEndOfMonth).mockReturnValue(2);
    vi.mocked(getPlayerCohorts).mockResolvedValue({
      corePlayers: [],
      optionalPlayers: [],
      missingCore: [],
      missingOptional: [],
      submittedUserIds: new Set(),
    });
    await processNotifications(new Date('2028-04-28T18:00:00Z'));
    expect(processGuildInactivity).not.toHaveBeenCalled();
    expect(sendT2FinalCall).not.toHaveBeenCalled();
  });

  it('does not fall back to ordinary T-4 DMs when inactivity processing fails', async () => {
    vi.mocked(getDaysUntilEndOfMonth).mockReturnValue(4);
    vi.mocked(processGuildInactivity).mockRejectedValueOnce(new Error('lookup unavailable'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    await processNotifications(new Date('2028-04-26T18:00:00Z'));
    expect(sendT4CoreReminder).not.toHaveBeenCalled();
    expect(sendT4OptionalReminder).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

describe('processGameReminders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries sessions for today and in 3 days', async () => {
    const now = new Date('2026-05-10T12:00:00Z');

    const mockQuery: any = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    };

    (db.select as any).mockReturnValue(mockQuery);

    await processGameReminders(now);

    expect(db.select).toHaveBeenCalledTimes(2);

    // First call for today
    expect(mockQuery.where).toHaveBeenNthCalledWith(1, expect.anything());
    // Second call for in 3 days
    expect(mockQuery.where).toHaveBeenNthCalledWith(2, expect.anything());
  });

  it('sends notifications for active games with channels', async () => {
    const now = new Date('2026-05-10T12:00:00Z');

    const mockSession = {
      gameId: 'game-1',
      gameName: 'Epic Quest',
      guildId: 'guild-1',
      channelId: 'channel-1',
      schedulingDetails: 'Some details',
      defaultSchedulingDetails: 'Default details',
    };

    const mockQuery: any = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        if (mockQuery.where.mock.calls.length === 1) {
          return Promise.resolve([mockSession]);
        }
        return Promise.resolve([]);
      }),
    };

    (db.select as any).mockReturnValue(mockQuery);

    await processGameReminders(now);

    expect(sendDiscordMessage).toHaveBeenCalledWith(
      { channelId: 'channel-1' },
      expect.objectContaining({
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('Epic Quest session today'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('uses default scheduling details if game details are missing', async () => {
    const now = new Date('2026-05-10T12:00:00Z');

    const mockSession = {
      gameId: 'game-1',
      gameName: 'Epic Quest',
      guildId: 'guild-1',
      channelId: 'channel-1',
      schedulingDetails: null,
      defaultSchedulingDetails: 'Default details',
    };

    const mockQuery: any = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(() => {
        if (mockQuery.where.mock.calls.length === 1) {
          return Promise.resolve([mockSession]);
        }
        return Promise.resolve([]);
      }),
    };

    (db.select as any).mockReturnValue(mockQuery);

    await processGameReminders(now);

    expect(sendDiscordMessage).toHaveBeenCalledWith(
      { channelId: 'channel-1' },
      expect.objectContaining({
        components: expect.arrayContaining([
          expect.objectContaining({
            components: expect.arrayContaining([
              expect.objectContaining({
                content: expect.stringContaining('Default details'),
              }),
            ]),
          }),
        ]),
      }),
    );
  });
});
