'use client';

import ThemeToggle from '@/components/ThemeToggle';
import SignInButton from '@/components/SignInButton';

export function HeaderActions() {
  return (
    <div className="flex items-center gap-4">
      <SignInButton />
      <ThemeToggle />
    </div>
  );
}
