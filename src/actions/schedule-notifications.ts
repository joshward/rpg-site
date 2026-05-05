'use server';

import { revalidatePath } from 'next/cache';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAdmin } from '@/actions/auth-helpers';
import { db } from '@/db/db';
import { game, scheduledSession, scheduleNotificationSend } from '@/db/schema/games';
import { sendDiscordMessage } from '@/lib/discord/api';

const NO_SESSIONS_SCHEDULED_MESSAGE = 'No sessions scheduled for this month.';
const MISSING_CHANNEL_REASON = 'No notification channel configured';
const UNEDITED_SINCE_LAST_NOTIFICATION = 'Unedited since last notification';

export interface ScheduleNotificationDialogGame {
  gameId: string;
  gameName: string;
  scheduledDays: number[];
  scheduledDayCount: number;
  scheduleNotificationChannelId: string | null;
  scheduleNotificationChannelName: string | null;
  hasPriorNotificationThisMonth: boolean;
  alreadySentThisMonth: boolean;
  lastSentAt: Date | null;
  uneditedSinceLastNotification: boolean;
  changedSinceLastNotification: boolean;
  defaultSelected: boolean;
  disabled: boolean;
  disabledReason: string | null;
  stateReason: string | null;
}

export interface ScheduleNotificationDialogData {
  year: number;
  month: number;
  games: ScheduleNotificationDialogGame[];
}

export interface ScheduleNotificationSelection {
  gameId: string;
  send: boolean;
}

export interface ScheduleNotificationSendResult {
  gameId: string;
  gameName: string;
  status: 'sent' | 'skipped' | 'failed';
  reason: string | null;
}

export interface ScheduleNotificationSendResponse {
  year: number;
  month: number;
  results: ScheduleNotificationSendResult[];
}

interface SelectionStateInput {
  hasNotificationChannel: boolean;
  scheduledDayCount: number;
  hasPriorNotificationThisMonth: boolean;
  uneditedSinceLastNotification: boolean;
}

interface SelectionState {
  defaultSelected: boolean;
  disabled: boolean;
  disabledReason: string | null;
  stateReason: string | null;
}

interface ScheduleNotificationContextGame {
  gameId: string;
  gameName: string;
  scheduleNotificationChannelId: string | null;
  scheduleNotificationChannelName: string | null;
  scheduledDays: number[];
  scheduleFingerprint: string;
  latestSuccessfulSend: {
    scheduleFingerprint: string;
    sentAt: Date;
  } | null;
}

function validateYearMonth(year: number, month: number) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new ActionError('Invalid year/month for schedule notifications.');
  }
}

export async function buildScheduleFingerprint(days: number[]): Promise<string> {
  return [...days].sort((a, b) => a - b).join(',');
}

export async function getScheduleNotificationSelectionState({
  hasNotificationChannel,
  scheduledDayCount,
  hasPriorNotificationThisMonth,
  uneditedSinceLastNotification,
}: SelectionStateInput): Promise<SelectionState> {
  if (!hasNotificationChannel) {
    return {
      defaultSelected: false,
      disabled: true,
      disabledReason: MISSING_CHANNEL_REASON,
      stateReason: null,
    };
  }

  if (hasPriorNotificationThisMonth && uneditedSinceLastNotification) {
    return {
      defaultSelected: false,
      disabled: false,
      disabledReason: null,
      stateReason: UNEDITED_SINCE_LAST_NOTIFICATION,
    };
  }

  return {
    defaultSelected: scheduledDayCount > 0,
    disabled: false,
    disabledReason: null,
    stateReason: null,
  };
}

export async function buildScheduleNotificationMessage({
  year,
  month,
  scheduledDays,
  changedSinceLastNotification,
}: {
  year: number;
  month: number;
  scheduledDays: number[];
  changedSinceLastNotification: boolean;
}): Promise<string> {
  if (scheduledDays.length === 0) {
    return NO_SESSIONS_SCHEDULED_MESSAGE;
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleString('en-US', { month: 'long' });
  const prefix = changedSinceLastNotification ? 'Schedule has changed. ' : '';

  return `${prefix}${monthLabel} ${year} scheduled days: ${[...scheduledDays].sort((a, b) => a - b).join(', ')}`;
}

async function getScheduleNotificationContextGames(
  guildId: string,
  year: number,
  month: number,
): Promise<ScheduleNotificationContextGame[]> {
  const activeGames = await db
    .select({
      gameId: game.id,
      gameName: game.name,
      scheduleNotificationChannelId: game.scheduleNotificationChannelId,
      scheduleNotificationChannelName: game.scheduleNotificationChannelName,
    })
    .from(game)
    .where(and(eq(game.guildId, guildId), eq(game.status, 'active')))
    .orderBy(game.name);

  if (activeGames.length === 0) {
    return [];
  }

  const activeGameIds = activeGames.map((g) => g.gameId);

  const scheduledDaysRows = await db
    .select({
      gameId: scheduledSession.gameId,
      day: scheduledSession.day,
    })
    .from(scheduledSession)
    .where(
      and(
        eq(scheduledSession.guildId, guildId),
        eq(scheduledSession.year, year),
        eq(scheduledSession.month, month),
        inArray(scheduledSession.gameId, activeGameIds),
      ),
    );

  const daysByGameId = new Map<string, number[]>();
  for (const row of scheduledDaysRows) {
    const days = daysByGameId.get(row.gameId) ?? [];
    days.push(row.day);
    daysByGameId.set(row.gameId, days);
  }

  const latestSuccessfulSendsRows = await db
    .select({
      gameId: scheduleNotificationSend.gameId,
      sentAt: scheduleNotificationSend.sentAt,
      scheduleFingerprint: scheduleNotificationSend.scheduleFingerprint,
    })
    .from(scheduleNotificationSend)
    .where(
      and(
        eq(scheduleNotificationSend.guildId, guildId),
        eq(scheduleNotificationSend.year, year),
        eq(scheduleNotificationSend.month, month),
        eq(scheduleNotificationSend.outcome, 'sent'),
        inArray(scheduleNotificationSend.gameId, activeGameIds),
      ),
    )
    .orderBy(desc(scheduleNotificationSend.sentAt));

  const latestSuccessfulByGame = new Map<
    string,
    {
      scheduleFingerprint: string;
      sentAt: Date;
    }
  >();

  for (const row of latestSuccessfulSendsRows) {
    if (!latestSuccessfulByGame.has(row.gameId)) {
      latestSuccessfulByGame.set(row.gameId, {
        scheduleFingerprint: row.scheduleFingerprint,
        sentAt: row.sentAt,
      });
    }
  }

  return Promise.all(
    activeGames.map(async (g) => {
      const scheduledDays = [...(daysByGameId.get(g.gameId) ?? [])].sort((a, b) => a - b);
      const latestSuccessfulSend = latestSuccessfulByGame.get(g.gameId) ?? null;

      return {
        gameId: g.gameId,
        gameName: g.gameName,
        scheduleNotificationChannelId: g.scheduleNotificationChannelId,
        scheduleNotificationChannelName: g.scheduleNotificationChannelName,
        scheduledDays,
        scheduleFingerprint: await buildScheduleFingerprint(scheduledDays),
        latestSuccessfulSend,
      };
    }),
  );
}

async function toDialogGame(
  contextGame: ScheduleNotificationContextGame,
  editedGameIds: Set<string> | null,
): Promise<ScheduleNotificationDialogGame> {
  const hasPriorNotificationThisMonth = !!contextGame.latestSuccessfulSend;
  const fingerprintMatchesLastSend =
    hasPriorNotificationThisMonth &&
    contextGame.latestSuccessfulSend?.scheduleFingerprint === contextGame.scheduleFingerprint;

  const uneditedSinceLastNotification = editedGameIds
    ? hasPriorNotificationThisMonth &&
      !editedGameIds.has(contextGame.gameId) &&
      !!fingerprintMatchesLastSend
    : !!fingerprintMatchesLastSend;

  const changedSinceLastNotification =
    hasPriorNotificationThisMonth && !uneditedSinceLastNotification && !fingerprintMatchesLastSend;

  const selectionState = await getScheduleNotificationSelectionState({
    hasNotificationChannel: !!contextGame.scheduleNotificationChannelId,
    scheduledDayCount: contextGame.scheduledDays.length,
    hasPriorNotificationThisMonth,
    uneditedSinceLastNotification,
  });

  return {
    gameId: contextGame.gameId,
    gameName: contextGame.gameName,
    scheduledDays: contextGame.scheduledDays,
    scheduledDayCount: contextGame.scheduledDays.length,
    scheduleNotificationChannelId: contextGame.scheduleNotificationChannelId,
    scheduleNotificationChannelName: contextGame.scheduleNotificationChannelName,
    hasPriorNotificationThisMonth,
    alreadySentThisMonth: hasPriorNotificationThisMonth,
    lastSentAt: contextGame.latestSuccessfulSend?.sentAt ?? null,
    uneditedSinceLastNotification,
    changedSinceLastNotification,
    defaultSelected: selectionState.defaultSelected,
    disabled: selectionState.disabled,
    disabledReason: selectionState.disabledReason,
    stateReason: selectionState.stateReason,
  };
}

export const getScheduleNotificationDialogData = asResult(
  'getScheduleNotificationDialogData',
  async (guildId: string, year: number, month: number, editedGameIds: string[] = []) => {
    await ensureAdmin(guildId);
    validateYearMonth(year, month);

    const editedSet = editedGameIds.length > 0 ? new Set(editedGameIds) : null;
    const contextGames = await getScheduleNotificationContextGames(guildId, year, month);

    return {
      year,
      month,
      games: await Promise.all(
        contextGames.map((contextGame) => toDialogGame(contextGame, editedSet)),
      ),
    } satisfies ScheduleNotificationDialogData;
  },
  'Something went wrong loading schedule notification data.',
);

export const sendScheduleNotifications = asResult(
  'sendScheduleNotifications',
  async (
    guildId: string,
    year: number,
    month: number,
    selections: ScheduleNotificationSelection[],
    editedGameIds: string[] = [],
  ) => {
    const { discordAccount } = await ensureAdmin(guildId);
    validateYearMonth(year, month);

    const editedSet = editedGameIds.length > 0 ? new Set(editedGameIds) : null;
    const contextGames = await getScheduleNotificationContextGames(guildId, year, month);
    const dialogGames = await Promise.all(
      contextGames.map((contextGame) => toDialogGame(contextGame, editedSet)),
    );
    const validGameIds = new Set(dialogGames.map((g) => g.gameId));

    for (const selection of selections) {
      if (!validGameIds.has(selection.gameId)) {
        throw new ActionError('Invalid game selected for schedule notifications.');
      }
    }

    const selectionByGameId = new Map(
      selections.map((selection) => [selection.gameId, selection.send]),
    );
    const results: ScheduleNotificationSendResult[] = [];

    for (const gameData of dialogGames) {
      const isSelected = selectionByGameId.get(gameData.gameId) === true;

      if (!isSelected) {
        results.push({
          gameId: gameData.gameId,
          gameName: gameData.gameName,
          status: 'skipped',
          reason: 'Not selected',
        });
        continue;
      }

      if (!gameData.scheduleNotificationChannelId) {
        results.push({
          gameId: gameData.gameId,
          gameName: gameData.gameName,
          status: 'skipped',
          reason: MISSING_CHANNEL_REASON,
        });
        continue;
      }

      const message = await buildScheduleNotificationMessage({
        year,
        month,
        scheduledDays: gameData.scheduledDays,
        changedSinceLastNotification: gameData.changedSinceLastNotification,
      });

      try {
        await sendDiscordMessage(
          { channelId: gameData.scheduleNotificationChannelId },
          {
            content: message,
          },
        );

        await db.insert(scheduleNotificationSend).values({
          guildId,
          gameId: gameData.gameId,
          year,
          month,
          scheduleFingerprint: await buildScheduleFingerprint(gameData.scheduledDays),
          sentByDiscordUserId: discordAccount.userId,
          outcome: 'sent',
          error: null,
        });

        results.push({
          gameId: gameData.gameId,
          gameName: gameData.gameName,
          status: 'sent',
          reason: null,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'Unknown send error';

        await db.insert(scheduleNotificationSend).values({
          guildId,
          gameId: gameData.gameId,
          year,
          month,
          scheduleFingerprint: await buildScheduleFingerprint(gameData.scheduledDays),
          sentByDiscordUserId: discordAccount.userId,
          outcome: 'failed',
          error: reason,
        });

        results.push({
          gameId: gameData.gameId,
          gameName: gameData.gameName,
          status: 'failed',
          reason,
        });
      }
    }

    revalidatePath(`/g/${guildId}/schedule`);

    return {
      year,
      month,
      results,
    } satisfies ScheduleNotificationSendResponse;
  },
  'Something went wrong sending schedule notifications.',
);
