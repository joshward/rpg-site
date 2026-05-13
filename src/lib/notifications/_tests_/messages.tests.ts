import { describe, expect, it } from 'vitest';
import {
  generateT4CoreReminderMessage,
  generateT4OptionalReminderMessage,
  getNotificationContext,
  generateGameSessionReminder,
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

  it('generates a game session reminder for today', () => {
    const message = generateGameSessionReminder({
      guildId: 'guild-1',
      gameName: 'Epic Quest',
      daysUntil: 0,
      sessionDate: new Date('2026-05-12T00:00:00Z'),
      schedulingDetails: 'Bring snacks!',
    });
    const content = JSON.stringify(message);
    expect(content).toContain('Epic Quest session today');
    expect(content).toContain('Bring snacks!');
    expect(content).toContain('View schedule');
  });

  it('generates a game session reminder for 3 days from now', () => {
    const message = generateGameSessionReminder({
      guildId: 'guild-1',
      gameName: 'Epic Quest',
      daysUntil: 3,
      sessionDate: new Date('2026-05-15T00:00:00Z'),
      schedulingDetails: 'Review your character sheets.',
    });
    const content = JSON.stringify(message);
    expect(content).toContain('Epic Quest session in 3 days');
    expect(content).toContain('Friday the 15th');
    expect(content).toContain('Review your character sheets.');
  });
});
