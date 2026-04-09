import { getOrdinalDate } from './utils';
import { getDaysInMonth, getNextMonth, type YearMonth } from '@/lib/availability';
import {
  type EmbedModel,
  type MessageComponentModel,
  ComponentType,
  ButtonStyle,
  MessageFlags,
} from '@/lib/discord/models';

export interface NotificationContext {
  guildId: string;
  guildName: string;
  targetMonthName: string;
  deadlineDate: string;
  webappLink: string;
  prefix?: string;
  target: YearMonth;
}

export interface DiscordMessage {
  content?: string;
  embeds?: EmbedModel[];
  components?: MessageComponentModel[];
  flags?: number;
}

const COLORS = {
  INFO: 0x3b82f6,
  SUCCESS: 0x10b981,
  WARNING: 0xf59e0b,
  DANGER: 0xef4444,
} as const;

export function generateStandardDM({
  guildId,
  target,
  guildName,
  targetMonthName,
  messageText,
  subMessage,
  webappLink,
  color = COLORS.INFO,
  prefix = '',
  includeInteractiveButtons = false,
}: {
  guildId: string;
  target: YearMonth;
  guildName: string;
  targetMonthName: string;
  messageText: string;
  subMessage?: string;
  webappLink: string;
  color?: number;
  prefix?: string;
  includeInteractiveButtons?: boolean;
}): DiscordMessage {
  const header1 = `${prefix}Roleplaying in ${guildName}`;
  const header2 = `${targetMonthName} Availability`;

  const textContent = [
    `**${header1}**`,
    `# ${header2}`,
    messageText,
    subMessage ? `-# ${subMessage}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  const monthStr = `${target.year}-${target.month.toString().padStart(2, '0')}`;

  const actionRow: MessageComponentModel = {
    type: ComponentType.ACTION_ROW,
    components: [
      {
        type: ComponentType.BUTTON,
        style: ButtonStyle.LINK,
        label: '📅 Submit Availability',
        url: webappLink,
      },
    ],
  };

  if (includeInteractiveButtons) {
    actionRow.components.push(
      {
        type: ComponentType.BUTTON,
        style: ButtonStyle.SECONDARY,
        label: '⏩ Skip this month',
        custom_id: `skip_month:${guildId}:${monthStr}`,
      },
      {
        type: ComponentType.BUTTON,
        style: ButtonStyle.SECONDARY,
        label: '⏸️ Pause participation for now',
        custom_id: `pause_participation:${guildId}:${monthStr}`,
      },
    );
  }

  return {
    flags: MessageFlags.IS_COMPONENTS_V2,
    components: [
      {
        type: ComponentType.CONTAINER,
        accent_color: color,
        components: [
          {
            type: ComponentType.TEXT_DISPLAY,
            content: textContent,
          },
          actionRow,
        ],
      },
    ],
  };
}

export function generateT10GlobalMessage(context: NotificationContext): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `Availability for **${context.targetMonthName}** is now open! 👍 Please fill it out when you get a chance.`,
    subMessage: `**Due by the ${context.deadlineDate}**`,
    color: COLORS.SUCCESS,
  });
}

export function generateT7ReminderMessage(context: NotificationContext): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `Hey! Roleplaying availability for **${context.targetMonthName}** is open. When you get a chance, please fill it out. Thanks! 👍`,
    subMessage: `**Due by the ${context.deadlineDate}**`,
    color: COLORS.INFO,
    includeInteractiveButtons: true,
  });
}

export function generateT4CoreReminderMessage(context: NotificationContext): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `Just a reminder to fill out your roleplaying availability for **${context.targetMonthName}**.`,
    subMessage: `I’ll be building the schedule in 4 days.`,
    color: COLORS.WARNING,
    includeInteractiveButtons: true,
  });
}

export function generateT4OptionalReminderMessage(context: NotificationContext): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `Hey! If you’re interested in joining any roleplaying games in **${context.targetMonthName}**, feel free to fill out your availability! 👍`,
    subMessage: `I’ll be building the schedule in 4 days.`,
    color: COLORS.INFO,
    includeInteractiveButtons: true,
  });
}

export function generateT2FinalCallDM(context: NotificationContext): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `**Final call! 📢** I’m building the schedule today with whoever has submitted availability.`,
    color: COLORS.DANGER,
    includeInteractiveButtons: true,
  });
}

export function generateT3AdminReport({
  corePlayersCount,
  missingCoreCount,
  optionalPlayersCount,
  missingOptionalCount,
}: {
  corePlayersCount: number;
  missingCoreCount: number;
  optionalPlayersCount: number;
  missingOptionalCount: number;
}): DiscordMessage {
  return {
    embeds: [
      {
        title: 'Heads up — availability deadline is tomorrow!',
        color: COLORS.WARNING,
        fields: [
          {
            name: 'Core Players',
            value: `${corePlayersCount - missingCoreCount}/${corePlayersCount} submitted`,
            inline: true,
          },
          {
            name: 'Optional Players',
            value: `${optionalPlayersCount - missingOptionalCount}/${optionalPlayersCount} submitted`,
            inline: true,
          },
        ],
      },
    ],
  };
}

export function generateT2FinalCallGlobal(
  context: NotificationContext,
  {
    submittedCount,
    totalActive,
  }: {
    submittedCount: number;
    totalActive: number;
  },
): DiscordMessage {
  return generateStandardDM({
    ...context,
    messageText: `**Final call for availability! 📢** The schedule will be created today.\n\n**${submittedCount}/${totalActive}** players have filled out their schedule.`,
    color: COLORS.DANGER,
  });
}

export function generateT2AdminReport({
  corePlayersCount,
  missingCoreCount,
  optionalPlayersCount,
  missingOptionalCount,
}: {
  corePlayersCount: number;
  missingCoreCount: number;
  optionalPlayersCount: number;
  missingOptionalCount: number;
}): DiscordMessage {
  return {
    embeds: [
      {
        title: 'Build the schedule today! 📅',
        color: COLORS.DANGER,
        fields: [
          {
            name: 'Core Players',
            value: `${corePlayersCount - missingCoreCount}/${corePlayersCount} submitted`,
            inline: true,
          },
          {
            name: 'Optional Players',
            value: `${optionalPlayersCount - missingOptionalCount}/${optionalPlayersCount} submitted`,
            inline: true,
          },
        ],
      },
    ],
  };
}

export function generateSimpleEmbed(
  title: string,
  description: string,
  type: 'info' | 'success' | 'warning' | 'danger' = 'info',
): DiscordMessage {
  const colorMap = {
    info: COLORS.INFO,
    success: COLORS.SUCCESS,
    warning: COLORS.WARNING,
    danger: COLORS.DANGER,
  };

  return {
    embeds: [
      {
        title,
        description,
        color: colorMap[type],
      },
    ],
  };
}

export function getNotificationContext(
  now: Date,
  guildId: string,
  guildName: string,
  webappLink: string,
  prefix?: string,
): NotificationContext {
  const target = getNextMonth(now);
  const targetMonthName = new Date(Date.UTC(target.year, target.month - 1, 1)).toLocaleDateString(
    'en-US',
    { month: 'long', timeZone: 'UTC' },
  );
  const deadlineDate = getOrdinalDate(
    getDaysInMonth(now.getUTCFullYear(), now.getUTCMonth() + 1) - 2,
  );

  return {
    guildId,
    guildName,
    targetMonthName,
    deadlineDate,
    webappLink,
    prefix,
    target,
  };
}
