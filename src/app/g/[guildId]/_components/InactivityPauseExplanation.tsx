import Link from '@/components/Link';
import type { PlayerInactivityPause } from '@/lib/inactivity-explanation';
import LocalDate from '@/components/LocalDate';

export default function InactivityPauseExplanation({
  guildId,
  pause,
  showPreferencesLink = true,
}: {
  guildId: string;
  pause: PlayerInactivityPause;
  showPreferencesLink?: boolean;
}) {
  return (
    <div className="space-y-2">
      <p>
        Your desired sessions were set to <strong>0</strong> on <LocalDate value={pause.pausedAt} />{' '}
        because you hadn’t submitted availability for a while. Availability reminders are paused.
      </p>
      <p>
        Ready to play again?{' '}
        {showPreferencesLink ? (
          <>
            <Link href={`/g/${guildId}/preferences`}>Update your desired sessions</Link> and{' '}
          </>
        ) : (
          'Choose your desired sessions below and '
        )}
        <Link href={`/g/${guildId}/availability`}>fill out your availability</Link>.
      </p>
      <p className="text-sm text-sage-11">
        Submitting availability won’t change your desired sessions—you’ll need to update both.
      </p>
    </div>
  );
}
