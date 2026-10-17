'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { setConsentCoordinator } from '@/actions/consent-coordinators';
import { isFailure } from '@/actions/result';
import Paper from '@/components/Paper';
import Button from '@/components/Button';
import Alert from '@/components/Alert';

export default function ConsentCoordinators({
  guildId,
  gameId,
  members,
}: {
  guildId: string;
  gameId: string;
  members: { discordUserId: string; displayName: string; isConsentCoordinator: boolean }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <Paper>
      <h2 className="text-xl font-bold">Consent coordinators</h2>
      <p className="text-sm text-sage-11">
        Assign saved game members to view this game’s checklist completion only. No answers or
        private notes are shared.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      {!members.length && <p>Save game members before assigning coordinators.</p>}
      {members.map((member) => (
        <div key={member.discordUserId} className="flex items-center justify-between gap-4 py-2">
          <span>
            {member.displayName}
            {member.isConsentCoordinator ? ' · Coordinator' : ''}
          </span>
          <Button
            disabled={pending}
            onClick={async () => {
              setPending(true);
              setError(null);
              try {
                const result = await setConsentCoordinator(
                  guildId,
                  gameId,
                  member.discordUserId,
                  !member.isConsentCoordinator,
                );
                if (isFailure(result)) setError(result.error);
                else router.refresh();
              } finally {
                setPending(false);
              }
            }}
          >
            {member.isConsentCoordinator ? 'Remove coordinator' : 'Assign coordinator'}
          </Button>
        </div>
      ))}
    </Paper>
  );
}
