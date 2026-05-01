import { describe, expect, it } from 'vitest';
import {
  generateT4CoreReminderMessage,
  generateT4OptionalReminderMessage,
  getNotificationContext,
} from '../messages';

describe('Notification reminder messages', () => {
  it('uses the actual time to deadline wording for the T4 core reminder', () => {
    const context = getNotificationContext(
      new Date('2026-04-26T00:00:00Z'),
      'guild-1',
      'Guild',
      'https://example.com',
    );

    const message = generateT4CoreReminderMessage(context);
    expect(JSON.stringify(message)).toContain('I’ll be building the schedule in 2 days.');
  });

  it('uses the actual time to deadline wording for the T4 optional reminder', () => {
    const context = getNotificationContext(
      new Date('2026-04-26T00:00:00Z'),
      'guild-1',
      'Guild',
      'https://example.com',
    );

    const message = generateT4OptionalReminderMessage(context);
    expect(JSON.stringify(message)).toContain('I’ll be building the schedule in 2 days.');
  });
});
