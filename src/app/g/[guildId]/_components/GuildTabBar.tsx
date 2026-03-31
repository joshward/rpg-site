'use client';

import { type ReactNode } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import {
  HomeIcon,
  CalendarIcon,
  GearIcon,
  MixerHorizontalIcon,
  RocketIcon,
} from '@radix-ui/react-icons';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

interface Tab {
  label: string;
  href: string;
  icon: ReactNode;
}

interface GuildTabBarProps {
  guildId: string;
  isAdmin: boolean;
}

export default function GuildTabBar({ guildId, isAdmin }: GuildTabBarProps) {
  const pathname = usePathname();
  const basePath = `/g/${guildId}`;

  const tabs: Tab[] = [
    { label: 'Overview', href: basePath, icon: <HomeIcon /> },
    { label: 'Availability', href: `${basePath}/availability`, icon: <CalendarIcon /> },
    { label: 'My Preferences', href: `${basePath}/preferences`, icon: <MixerHorizontalIcon /> },
    ...(isAdmin
      ? [
          { label: 'Games', href: `${basePath}/games`, icon: <RocketIcon /> },
          { label: 'Guild Settings', href: `${basePath}/admin`, icon: <GearIcon /> },
        ]
      : []),
  ];

  return (
    <nav className="flex gap-1 border-b border-sage-6">
      {tabs.map((tab) => {
        const isActive =
          tab.href === basePath ? pathname === basePath : pathname.startsWith(tab.href);

        return (
          <NextLink
            key={tab.href}
            href={tab.href}
            className={twMerge(
              DefaultTransitionStyles,
              FocusResetStyles,
              ShowFocusOnKeyboardStyles,
              'flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md -mb-px',
              'text-sage-11 hover:text-sage-12 hover:bg-sage-3',
              isActive && 'text-sage-12 border-b-2 border-violet-9 bg-sage-3',
            )}
          >
            {tab.icon}
            {tab.label}
          </NextLink>
        );
      })}
    </nav>
  );
}
