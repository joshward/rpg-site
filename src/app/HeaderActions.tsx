'use client';

import ThemeToggle from '@/components/ThemeToggle';
import SignInButton from '@/components/SignInButton';

export function HeaderActions() {
  return (
    <div className="flex items-center gap-4 grow md:grow-0 justify-end">
      <SignInButton />
      <ThemeToggle />
    </div>
  );
}
