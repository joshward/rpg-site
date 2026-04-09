import { getOrdinalDate } from './utils';
import { getDaysInMonth, getNextMonth } from '@/lib/availability';

export interface NotificationContext {
  guildName: string;
  targetMonthName: string;
  deadlineDate: string;
  webappLink: string;
}

export function generateT10GlobalMessage({
  targetMonthName,
  deadlineDate,
  webappLink,
}: NotificationContext) {
  return `Availability for ${targetMonthName} is now open 👍 Please fill it out when you get a chance. ${webappLink} (Due by the ${deadlineDate})`;
}

export function generateT7ReminderMessage({
  guildName,
  targetMonthName,
  deadlineDate,
  webappLink,
}: NotificationContext) {
  return `From ${guildName}: Hey! Roleplaying availability for ${targetMonthName} is open. When you get a chance, please fill it out. Thanks 👍! ${webappLink} (Due by the ${deadlineDate}).`;
}

export function generateT4CoreReminderMessage({
  guildName,
  targetMonthName,
  webappLink,
}: NotificationContext) {
  return `From ${guildName}: Reminder to fill out your roleplaying availability for ${targetMonthName}. I’ll be building the schedule in 4 days. ${webappLink}`;
}

export function generateT4OptionalReminderMessage({
  guildName,
  targetMonthName,
  webappLink,
}: NotificationContext) {
  return `From ${guildName}: Hey! If you’re interested in joining any roleplaying games in ${targetMonthName}, feel free to fill out your availability 👍. I’ll be building the schedule in 4 days. ${webappLink}`;
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
}) {
  return `Heads up — availability deadline is tomorrow.\nCurrent: ${corePlayersCount - missingCoreCount}/${corePlayersCount} core players, ${optionalPlayersCount - missingOptionalCount}/${optionalPlayersCount} optional players submitted.`;
}

export function generateT2FinalCallDM({
  guildName,
  webappLink,
}: {
  guildName: string;
  webappLink: string;
}) {
  return `From ${guildName}: Final call — I’m building the schedule today with whoever has submitted availability. ${webappLink}`;
}

export function generateT2FinalCallGlobal({
  submittedCount,
  totalActive,
}: {
  submittedCount: number;
  totalActive: number;
}) {
  return `Final call for availability schedule will be created today. ${submittedCount}/${totalActive} players (core + optional) have filled out their schedule.`;
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
}) {
  return `Build the schedule today.\nCurrent: ${corePlayersCount - missingCoreCount}/${corePlayersCount} core players, ${optionalPlayersCount - missingOptionalCount}/${optionalPlayersCount} optional players submitted.`;
}

export function getNotificationContext(
  now: Date,
  guildName: string,
  webappLink: string,
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
    guildName,
    targetMonthName,
    deadlineDate,
    webappLink,
  };
}
