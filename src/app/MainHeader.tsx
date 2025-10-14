import { HeaderActions } from './HeaderActions';

export function MainHeader() {
  return (
    <header className="flex items-center justify-between gap-6 p-4 md:p-6">
      <div className="flex grow items-center gap-4 md:gap-6">
        <h1 className="text-slate-12 text-4xl font-serif font-medium">Tavern Master</h1>
      </div>
      <HeaderActions />
    </header>
  );
}
