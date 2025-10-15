'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import { twMerge } from 'tailwind-merge';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

export function HeaderActions() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const toTheme = resolvedTheme === 'dark' ? 'light' : 'dark';

  return (
    <div>
      {mounted ? (
        <button
          onClick={() => setTheme(toTheme)}
          className={twMerge(
            DefaultTransitionStyles,
            FocusResetStyles,
            ShowFocusOnKeyboardStyles,
            'bg-sage-5 hover:bg-sage-7 text-sage-12 cursor-pointer rounded-xl p-3 shadow shadow-black-a5',
          )}
          aria-label={`Toggle to ${toTheme} mode`}
        >
          {toTheme === 'light' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
        </button>
      ) : (
        <div className="size-10 bg-sage-5 rounded-xl shadow shadow-black-a5 animate-pulse" />
      )}
    </div>
  );
}
