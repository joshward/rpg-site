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

  it('returns exact no-sessions message for zero-day schedules', async () => {
    expect(
      await buildScheduleNotificationMessage({
        year: 2026,
        month: 5,
        scheduledDays: [],
        changedSinceLastNotification: false,
      }),
    ).toBe('No sessions scheduled for this month.');
  });

  it('includes changed prefix for edited schedules', async () => {
    expect(
      await buildScheduleNotificationMessage({
        year: 2026,
        month: 5,
        scheduledDays: [6, 12],
        changedSinceLastNotification: true,
      }),
    ).toContain('Schedule has changed.');
  });
});
