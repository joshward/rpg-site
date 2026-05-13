import { describe, expect, it, vi } from 'vitest';

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/actions/auth-helpers', () => ({
  ensureAdmin: vi.fn(),
}));

vi.mock('@/db/db', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
}));

vi.mock('@/lib/discord/api', () => ({
  sendDiscordMessage: vi.fn(),
}));

import {
  buildScheduleFingerprint,
  buildScheduleNotificationMessage,
  getScheduleNotificationSelectionState,
} from '../schedule-notifications';
import { NO_SESSIONS_SCHEDULED_MESSAGE } from '@/lib/notifications/messages';

describe('schedule notification helpers', () => {
  it('builds stable schedule fingerprints by sorting days', async () => {
    expect(await buildScheduleFingerprint([14, 2, 9])).toBe('2,9,14');
  });

  it('disables selection when channel is missing', async () => {
    expect(
      await getScheduleNotificationSelectionState({
        hasNotificationChannel: false,
        scheduledDayCount: 3,
        hasPriorNotificationThisMonth: false,
        uneditedSinceLastNotification: false,
      }),
    ).toEqual({
      defaultSelected: false,
      disabled: true,
      disabledReason: 'No notification channel configured',
      stateReason: null,
    });
  });

  it('defaults unchecked with unedited label when already sent and unchanged', async () => {
    expect(
      await getScheduleNotificationSelectionState({
        hasNotificationChannel: true,
        scheduledDayCount: 4,
        hasPriorNotificationThisMonth: true,
        uneditedSinceLastNotification: true,
      }),
    ).toEqual({
      defaultSelected: false,
      disabled: false,
      disabledReason: null,
      stateReason: 'Unedited since last notification',
    });
  });

  it('defaults checked for games with scheduled days when not blocked by prior unchanged send', async () => {
    expect(
      await getScheduleNotificationSelectionState({
        hasNotificationChannel: true,
        scheduledDayCount: 2,
        hasPriorNotificationThisMonth: false,
        uneditedSinceLastNotification: false,
      }),
    ).toEqual({
      defaultSelected: true,
      disabled: false,
      disabledReason: null,
      stateReason: null,
    });
  });

  it('defaults unchecked for games with no scheduled days and no prior notification', async () => {
    expect(
      await getScheduleNotificationSelectionState({
        hasNotificationChannel: true,
        scheduledDayCount: 0,
        hasPriorNotificationThisMonth: false,
        uneditedSinceLastNotification: false,
      }),
    ).toEqual({
      defaultSelected: false,
      disabled: false,
      disabledReason: null,
      stateReason: null,
    });
  });

  it('defaults checked for games with cleared schedule when prior notification exists', async () => {
    expect(
      await getScheduleNotificationSelectionState({
        hasNotificationChannel: true,
        scheduledDayCount: 0,
        hasPriorNotificationThisMonth: true,
        uneditedSinceLastNotification: false,
      }),
    ).toEqual({
      defaultSelected: true,
      disabled: false,
      disabledReason: null,
      stateReason: null,
    });
  });

  it('returns exact no-sessions message for zero-day schedules', async () => {
    const message = await buildScheduleNotificationMessage({
      guildId: 'guild-1',
      year: 2026,
      month: 5,
      gameName: 'Test Game',
      scheduledDays: [],
      changedSinceLastNotification: false,
      schedulingDetails: 'Weekly on Fridays',
    });
    expect(JSON.stringify(message)).toContain(NO_SESSIONS_SCHEDULED_MESSAGE);
    expect(JSON.stringify(message)).toContain('Test Game May 2026 Schedule');
  });

  it('includes changed prefix for edited schedules', async () => {
    const message = await buildScheduleNotificationMessage({
      guildId: 'guild-1',
      year: 2026,
      month: 5,
      gameName: 'Test Game',
      scheduledDays: [6, 12],
      changedSinceLastNotification: true,
      schedulingDetails: null,
    });
    expect(JSON.stringify(message)).toContain('Schedule has changed.');
  });

  it('includes ordinal dates and days of the week in the message', async () => {
    const message = await buildScheduleNotificationMessage({
      guildId: 'guild-1',
      year: 2026,
      month: 5,
      gameName: 'Test Game',
      scheduledDays: [1, 2, 3, 4],
      changedSinceLastNotification: false,
      schedulingDetails: 'Some details',
    });
    const content = JSON.stringify(message);
    expect(content).toContain('1st (Friday)');
    expect(content).toContain('2nd (Saturday)');
    expect(content).toContain('3rd (Sunday)');
    expect(content).toContain('4th (Monday)');
    expect(content).toContain('Some details');
    expect(content).toContain('Test Game May 2026 Schedule');
  });
});
