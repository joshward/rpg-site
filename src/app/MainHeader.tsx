import { ReactNode } from 'react';
import { HeaderActions } from './HeaderActions';

export function MainHeader({ guildBadge }: { guildBadge?: ReactNode }) {
  return (
    <header className="flex flex-wrap md:flex-nowrap items-center md:justify-between gap-6 p-2 md:p-6">
      <div className="flex items-center gap-4 md:gap-6">
        <h1 className="text-slate-12 text-4xl font-serif font-medium">Tavern Master</h1>
      </div>
      {guildBadge && (
        <div className="order-last md:order-0 basis-full md:basis-auto">{guildBadge}</div>
      )}
      <HeaderActions />
    </header>
  );
}
