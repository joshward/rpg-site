import { generateStandardDM } from './messages';
import { parseMonth } from '@/lib/inactivity';

export function generateInactivityPauseMessage({
  guildId,
  guildName,
  checkedMonths,
  availabilityUrl,
  preview = false,
}: {
  guildId: string;
  guildName: string;
  checkedMonths: string[];
  availabilityUrl: string;
  preview?: boolean;
}) {
  const targetIndex = parseMonth(checkedMonths[checkedMonths.length - 1]);
  const target = { year: Math.floor(targetIndex / 12), month: (targetIndex % 12) + 1 };
  const disclaimer = preview
    ? '**TEST PREVIEW ONLY — no preferences were changed. This is an illustrative example, not a statement about your submissions.**\n\n'
    : '';
  return generateStandardDM({
    guildId,
    guildName,
    target,
    targetMonthName: '', // This card has its own title rather than a month heading.
    title: 'Taking a break? No worries 👋',
    messageText: `${disclaimer}I haven’t seen your availability for a while, so I’ve set your desired sessions to **0** so you won’t keep getting availability reminders.\n\nReady to play again? Just update your desired sessions and fill out your availability. I’d love to have you back! 🎲`,
    subMessage:
      'Submitting availability won’t change your desired sessions—you’ll need to update both.',
    webappLink: availabilityUrl,
    includePreferencesButton: true,
  });
}
