import { notFound } from 'next/navigation';
import { getGuildInfo } from '@/actions/guilds';
import { getGameConsentStatus } from '@/actions/consent-game-status';
import { isFailure } from '@/actions/result';
import { getDefaultMetadata } from '@/lib/metadata';
import Paper from '@/components/Paper';
import Link from '@/components/Link';

export const metadata = getDefaultMetadata({ subtitles: ['Game Consent Status'] });

export default async function GameConsentStatusPage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  const info = await getGuildInfo(guildId);
  if (isFailure(info) || info.data.role !== 'admin' || !info.data.consentChecklistAvailable) {
    notFound();
  }

  // This read rechecks admin access, impersonation, the server/guild gates,
  // game ownership and game mode. The page check alone is not authorization.
  const result = await getGameConsentStatus(guildId, gameId);
  if (isFailure(result)) notFound();
  const { gameName, mode, hasTopics, members } = result.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/g/${guildId}/games/${gameId}`}
          className="text-sm text-plum-11 hover:underline"
        >
          Back to game editor
        </Link>
        <h1 className="text-2xl font-bold mt-2">Consent status: {gameName}</h1>
        <p className="text-sm text-sage-11 mt-1">
          {mode === 'optional' ? 'Optional' : 'Requested'} · Guild checklist completion only. This
          does not indicate game-specific consent. Answers, heads-up choices and private notes are
          not shown.
        </p>
      </div>
      <Paper>
        {!hasTopics ? (
          <p>Official consent topics are not configured yet.</p>
        ) : members.length === 0 ? (
          <p>No members are assigned to this game yet.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-sage-6 text-sage-11">
                <th scope="col" className="py-2 pr-4">
                  Member
                </th>
                <th scope="col" className="py-2">
                  Checklist
                </th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.discordUserId} className="border-b border-sage-5 last:border-0">
                  <td className="py-3 pr-4">{member.displayName}</td>
                  <td className="py-3">
                    {member.status === 'complete'
                      ? 'Complete'
                      : member.status === 'in-progress'
                        ? 'In progress'
                        : 'Not started'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Paper>
    </div>
  );
}
