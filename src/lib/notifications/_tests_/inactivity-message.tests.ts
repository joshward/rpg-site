import { expect, it } from 'vitest';
import { generateInactivityPauseMessage } from '../inactivity-message';
import { ComponentType, ButtonStyle, MessageFlags } from '@/lib/discord/models';
import { config } from '@/lib/config';
import { joinUrl } from '@/lib/urls';

const details = {
  guildId: 'guild',
  guildName: 'Test Guild',
  checkedMonths: ['2028-03', '2028-04', '2028-05'],
  availabilityUrl: 'https://example.test/availability',
};

it('uses the standard card, friendly first-person copy, small note and two return links', () => {
  const message = generateInactivityPauseMessage(details);
  expect(message.flags).toBe(MessageFlags.IS_COMPONENTS_V2);
  const card = message.components![0];
  expect(card.type).toBe(ComponentType.CONTAINER);
  if (card.type !== ComponentType.CONTAINER) throw new Error('Expected a card');
  const text = card.components[0];
  expect(text.type).toBe(ComponentType.TEXT_DISPLAY);
  if (text.type !== ComponentType.TEXT_DISPLAY) throw new Error('Expected text');
  expect(text.content).toContain('**Roleplaying in Test Guild**');
  expect(text.content).toContain('# Taking a break? No worries 👋');
  expect(text.content).toContain(
    'I’ve set your desired sessions to **0** so you won’t keep getting availability reminders.',
  );
  expect(text.content).toContain('I’d love to have you back! 🎲');
  expect(text.content).toContain(
    '-# Submitting availability won’t change your desired sessions—you’ll need to update both.',
  );
  expect(text.content).not.toContain('Availability checked');
  expect(text.content).not.toMatch(
    /game memberships|will be set|two months|two reminders|TEST PREVIEW/i,
  );
  expect(card.components[1]).toEqual({
    type: ComponentType.ACTION_ROW,
    components: [
      {
        type: ComponentType.BUTTON,
        style: ButtonStyle.LINK,
        label: 'Update preferences',
        url: joinUrl(config.siteUrl, '/g/guild/preferences'),
      },
      {
        type: ComponentType.BUTTON,
        style: ButtonStyle.LINK,
        label: '📅 Submit Availability',
        url: details.availabilityUrl,
      },
    ],
  });
});

it('places the preview disclaimer inside the card without changing its links', () => {
  const preview = generateInactivityPauseMessage({ ...details, preview: true });
  expect(JSON.stringify(preview)).toContain('TEST PREVIEW ONLY — no preferences were changed.');
  expect(preview.flags).toBe(MessageFlags.IS_COMPONENTS_V2);
  expect(preview.components![0]).not.toHaveProperty('content');
});
