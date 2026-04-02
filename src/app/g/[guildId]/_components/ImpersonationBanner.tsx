'use client';

import { useTransition } from 'react';
import { stopImpersonation } from '@/actions/auth-actions';
import Button from '@/components/Button';
import { ExitIcon } from '@radix-ui/react-icons';

interface ImpersonationBannerProps {
  guildId: string;
}

export default function ImpersonationBanner({ guildId }: ImpersonationBannerProps) {
  const [isPending, startTransition] = useTransition();

  const handleStop = () => {
    startTransition(async () => {
      await stopImpersonation(guildId);
    });
  };

  return (
    <div className="rounded-md bg-amber-3 border border-amber-6 text-amber-12 px-4 py-3 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold uppercase tracking-wider bg-amber-9 text-amber-1 px-1.5 py-0.5 rounded text-[10px]">
          Impersonating
        </span>
        <p className="text-sm">
          You are currently acting as this guild member. All actions will be attributed to them.
        </p>
      </div>
      <Button
        size="sm"
        onClick={handleStop}
        disabled={isPending}
        className="bg-amber-1 border-amber-7 hover:bg-amber-4 text-amber-12"
      >
        <ExitIcon className="mr-2 h-4 w-4" />
        Stop Impersonating
      </Button>
    </div>
  );
}
