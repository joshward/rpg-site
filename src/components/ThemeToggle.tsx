'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { SunIcon, MoonIcon } from '@radix-ui/react-icons';
import Button from '@/components/Button';

export default function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  useEffect(() => setMounted(true), []);

  const toTheme = !mounted || resolvedTheme === 'light' ? 'dark' : 'light';

  return (
    <Button
      loading={!mounted}
      onClick={() => setTheme(toTheme)}
      aria-label={`Toggle to ${toTheme} mode`}
      size="lg"
    >
      {toTheme === 'light' ? <SunIcon className="size-4" /> : <MoonIcon className="size-4" />}
    </Button>
  );
}
