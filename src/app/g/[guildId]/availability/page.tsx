import { Metadata } from 'next';
import Alert from '@/components/Alert';
import Link from '@/components/Link';
import {
  getMyAvailability,
  getAdminMemberAvailability,
  type DayAvailability,
} from '@/actions/availability';
import { getGuildInfo } from '@/actions/guilds';
import { getMemberGames } from '@/actions/games';
import { getMyPreference, getAdminMemberPreference } from '@/actions/preferences';
import { isFailure } from '@/actions/result';
import { ensureAccess } from '@/actions/auth-helpers';
import { getGuildMembers } from '@/lib/discord/api';
import { getDefaultMetadata } from '@/lib/metadata';
import {
  getDefaultAvailabilityMonth,
  getEditableMonths,
  getCurrentMonth,
  getNextMonth,
  getPrevYearMonth,
  getSubmissionWindowOpen,
  isSameMonth,
  type YearMonth,
} from '@/lib/availability';
import { GuildRouteProps, getGuildName } from '../helpers';
import AvailabilityView from './_components/AvailabilityView';
import MonthNav from './_components/MonthNav';
import MemberAvailabilitySummary from './_components/MemberAvailabilitySummary';

interface AvailabilityPageProps extends GuildRouteProps {
  searchParams: Promise<{ year?: string; month?: string; userId?: string }>;
}

export async function generateMetadata({ params }: AvailabilityPageProps): Promise<Metadata> {
  const { guildId } = await params;
  const guildName = await getGuildName(guildId);
  return getDefaultMetadata({
    subtitles: ['Availability', guildName].filter(Boolean) as string[],
  });
}

export default async function AvailabilityPage({ params, searchParams }: AvailabilityPageProps) {
  const { guildId } = await params;
  const query = await searchParams;
  const targetUserId = query.userId;

  const access = await ensureAccess(guildId);
  const currentDiscordUserId = access.discordAccount.userId;

  let targetMember: { username: string; displayName: string } | null = null;
  if (targetUserId) {
    // Verify admin access for this specific feature
    if (access.role !== 'admin') {
      return <Alert type="error">Only guild administrators can perform this action.</Alert>;
    }

    // Fetch member info from Discord to show who we are editing
    const members = await getGuildMembers({ guildId });
    const member = members.find((m) => m.user.id === targetUserId);
    if (member) {
      targetMember = {
        username: member.user.username,
        displayName: member.nick || member.user.global_name || member.user.username,
      };
    }
  }

  // Check preferences and guild info
  const [prefResult, guildInfoResult, gamesResult] = await Promise.all([
    targetUserId ? getAdminMemberPreference(guildId, targetUserId) : getMyPreference(guildId),
    getGuildInfo(guildId),
    getMemberGames(guildId, targetUserId || currentDiscordUserId),
  ]);

  if (isFailure(prefResult)) {
    return <Alert type="error">{prefResult.error}</Alert>;
  }

  const guildData = isFailure(guildInfoResult) ? null : guildInfoResult.data;

  const preferenceUnset = prefResult.data.sessionsPerMonth === null;

  // Default month: next month if in last 10 days of current month, otherwise current month
  const defaultMonth = getDefaultAvailabilityMonth();

  // Determine which month to view from search params
  const queryYear = query.year ? Number.parseInt(query.year, 10) : NaN;
  const queryMonth = query.month ? Number.parseInt(query.month, 10) : NaN;
  const hasValidParams =
    Number.isInteger(queryYear) &&
    Number.isInteger(queryMonth) &&
    queryMonth >= 1 &&
    queryMonth <= 12;
  const viewedMonth: YearMonth = hasValidParams
    ? { year: queryYear, month: queryMonth }
    : defaultMonth;

  // Is this month editable?
  // Current month and next month are always editable
  const editableMonths = getEditableMonths();
  const isTargetEditable = editableMonths.some((m) => isSameMonth(viewedMonth, m));

  const windowOpen = isTargetEditable;

  // Is this a future month where the window hasn't opened yet?
  // Since next month is now always open, we only check further future
  const currentMonth = getCurrentMonth();
  const nextMonth = getNextMonth();
  const isFarFutureMonth =
    !isSameMonth(viewedMonth, currentMonth) && !isSameMonth(viewedMonth, nextMonth);
  const windowOpensAt = isFarFutureMonth
    ? getSubmissionWindowOpen(viewedMonth).toISOString()
    : null;

  // Fetch existing submission if any
  const existingResult = targetUserId
    ? await getAdminMemberAvailability(guildId, viewedMonth.year, viewedMonth.month, targetUserId)
    : await getMyAvailability(guildId, viewedMonth.year, viewedMonth.month);

  if (isFailure(existingResult)) {
    return <Alert type="error">{existingResult.error}</Alert>;
  }

  // Fetch previous month's data for copy feature (only when editable and preferences set)
  let previousMonthDays: DayAvailability[] | null = null;
  if (windowOpen && !preferenceUnset) {
    const prevMonth = getPrevYearMonth(viewedMonth);
    const prevResult = targetUserId
      ? await getAdminMemberAvailability(guildId, prevMonth.year, prevMonth.month, targetUserId)
      : await getMyAvailability(guildId, prevMonth.year, prevMonth.month);

    if (!isFailure(prevResult) && prevResult.data) {
      previousMonthDays = prevResult.data.days;
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {targetMember && (
        <Alert type="info">
          You are editing availability for <strong>{targetMember.displayName}</strong>.
        </Alert>
      )}

      <MonthNav current={viewedMonth} defaultMonth={defaultMonth} userId={targetUserId} />

      {!isFailure(gamesResult) && (
        <MemberAvailabilitySummary
          guildId={guildId}
          games={gamesResult.data}
          sessionsPerMonth={prefResult.data.sessionsPerMonth}
          supportChannelId={guildData?.supportChannelId}
          supportChannelName={guildData?.supportChannelName}
          adminContactInfo={guildData?.adminContactInfo}
          isReadOnly={!!targetUserId}
        />
      )}

      {preferenceUnset && windowOpen ? (
        <Alert type="warning">
          {targetUserId ? (
            <>
              This user has not set their session preference. Please{' '}
              <Link href={`/g/${guildId}/admin`}>configure it in User Config</Link> first.
            </>
          ) : (
            <>
              Please <Link href={`/g/${guildId}/preferences`}>set your session preference</Link>{' '}
              before filling out your availability.
            </>
          )}
        </Alert>
      ) : (
        <AvailabilityView
          key={`${viewedMonth.year}-${viewedMonth.month}-${targetUserId}`}
          target={viewedMonth}
          existing={existingResult.data}
          windowOpen={windowOpen && !preferenceUnset}
          previousMonthDays={previousMonthDays}
          windowOpensAt={windowOpensAt}
          userId={targetUserId}
          guildInfo={
            guildData
              ? {
                  supportChannelId: guildData.supportChannelId,
                  supportChannelName: guildData.supportChannelName,
                  adminContactInfo: guildData.adminContactInfo,
                }
              : undefined
          }
        />
      )}
    </div>
  );
}
