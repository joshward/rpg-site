import Link from '@/components/Link';
import { NO_LIMIT } from '@/lib/preferences';
import { getContactInfo } from '../../helpers';

interface GameInfo {
  id: string;
  name: string;
  sessionsPerMonth: number;
  isRequired: boolean;
}

interface MemberAvailabilitySummaryProps {
  guildId: string;
  games: GameInfo[];
  sessionsPerMonth: number | null;
  supportChannelId?: string | null;
  supportChannelName?: string | null;
  adminContactInfo?: string | null;
  isReadOnly?: boolean;
}

export default function MemberAvailabilitySummary({
  guildId,
  games,
  sessionsPerMonth,
  supportChannelId,
  supportChannelName,
  adminContactInfo,
  isReadOnly,
}: MemberAvailabilitySummaryProps) {
  const coreGames = games.filter((g) => g.isRequired);
  const optionalGames = games.filter((g) => !g.isRequired);

  const coreSessions = coreGames.reduce((acc, g) => acc + g.sessionsPerMonth, 0);
  const optionalSessions = optionalGames.reduce((acc, g) => acc + g.sessionsPerMonth, 0);

  const formatList = (names: string[]) => {
    if (names.length === 0) return '';
    if (names.length === 1) return `"${names[0]}"`;
    if (names.length === 2) return `"${names[0]}" and "${names[1]}"`;
    return (
      names
        .slice(0, -1)
        .map((n) => `"${n}"`)
        .join(', ') + `, and "${names[names.length - 1]}"`
    );
  };

  const prefText =
    sessionsPerMonth === NO_LIMIT
      ? 'no limit of'
      : sessionsPerMonth === null
        ? 'an unset number of'
        : `${sessionsPerMonth}`;

  const isOverScheduled =
    sessionsPerMonth !== null && sessionsPerMonth !== NO_LIMIT && coreSessions > sessionsPerMonth;

  const { adminText, channelLink, channelName } = getContactInfo(
    guildId,
    supportChannelId || undefined,
    supportChannelName || undefined,
    adminContactInfo || undefined,
  );

  return (
    <div className="flex flex-col gap-2 text-sm text-muted-foreground border-l-4 border-muted pl-4 py-1 mb-2">
      {coreGames.length > 0 && (
        <p>
          You are a core member in {formatList(coreGames.map((g) => g.name))} for a total of{' '}
          {coreSessions} {coreSessions === 1 ? 'session' : 'sessions'} per month.
        </p>
      )}
      {optionalGames.length > 0 && (
        <p>
          You are an optional member in {formatList(optionalGames.map((g) => g.name))} for a total
          of {optionalSessions} {optionalSessions === 1 ? 'session' : 'sessions'} per month.
        </p>
      )}
      <p>
        Your preferences are to attend {prefText} games per month.{' '}
        {!isReadOnly ? (
          <Link
            href={`/g/${guildId}/preferences`}
            className="text-primary hover:underline font-medium"
          >
            Update your preferences
          </Link>
        ) : (
          <Link href={`/g/${guildId}/admin`} className="text-primary hover:underline font-medium">
            Update preferences in User Config
          </Link>
        )}
      </p>

      {isOverScheduled && (
        <p className="text-ruby-11 font-bold">
          You are scheduled for more than your preferences.{' '}
          {!isReadOnly ? (
            <Link href={`/g/${guildId}/preferences`}>Update your preferences</Link>
          ) : (
            <Link href={`/g/${guildId}/admin`}>Update preferences</Link>
          )}{' '}
          or {adminText}
          {channelLink && (
            <>
              {' '}
              or reach out in <Link href={channelLink}>#{channelName || 'support'}</Link>
            </>
          )}{' '}
          if you cannot participate.
        </p>
      )}

      {sessionsPerMonth === 0 && coreGames.length === 0 && (
        <p>
          You can still fill out your schedule to attend optional games if you&apos;d like. Just let{' '}
          {adminContactInfo || 'your guild admin'} know that you are interested.
        </p>
      )}
    </div>
  );
}
