import { describe, expect, it, vi, beforeEach } from 'vitest';
import { processGameReminders } from '../service';
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

vi.mock('../utils', () => ({
  getDaysUntilEndOfMonth: vi.fn(),
  getPrefix: vi.fn(() => ''),
}));

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
