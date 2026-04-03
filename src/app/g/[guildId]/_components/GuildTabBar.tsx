'use client';

import { type ReactNode, useMemo } from 'react';
import NextLink from 'next/link';
import { usePathname } from 'next/navigation';
import { twMerge } from 'tailwind-merge';
import {
  HomeIcon,
  CalendarIcon,
  GearIcon,
  MixerHorizontalIcon,
  RocketIcon,
  ClockIcon,
  HamburgerMenuIcon,
} from '@radix-ui/react-icons';
import { Menu } from '@base-ui/react/menu';
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

  const tabs: Tab[] = useMemo(
    () => [
      { label: 'Overview', href: basePath, icon: <HomeIcon /> },
      { label: 'Availability', href: `${basePath}/availability`, icon: <CalendarIcon /> },
      { label: 'My Preferences', href: `${basePath}/preferences`, icon: <MixerHorizontalIcon /> },
      ...(isAdmin
        ? [
            { label: 'Games', href: `${basePath}/games`, icon: <RocketIcon /> },
            { label: 'Schedule', href: `${basePath}/schedule`, icon: <ClockIcon /> },
            { label: 'Guild Settings', href: `${basePath}/admin`, icon: <GearIcon /> },
          ]
        : []),
    ],
    [basePath, isAdmin],
  );

  const currentTab = useMemo(() => {
    return (
      tabs.find((tab) => {
        if (tab.href === basePath) {
          return pathname === basePath;
        }
        return pathname.startsWith(tab.href);
      }) || tabs[0]
    );
  }, [tabs, pathname, basePath]);

  return (
    <div className="w-full">
      {/* Mobile Dropdown Menu */}
      <div className="md:hidden">
        <Menu.Root>
          <Menu.Trigger
            className={twMerge(
              DefaultTransitionStyles,
              FocusResetStyles,
              ShowFocusOnKeyboardStyles,
              'flex w-full items-center justify-between gap-1.5 px-4 py-3 text-sm font-medium outline-none',
              'text-sage-12 border-b-2 border-violet-9 bg-sage-3',
            )}
          >
            <div className="flex items-center gap-1.5">
              {currentTab.icon}
              {currentTab.label}
            </div>
            <HamburgerMenuIcon className="size-5" />
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={4} align="start" className="z-50 w-[var(--anchor-width)]">
              <Menu.Popup className="bg-sage-1 border border-sage-4 p-1 text-sage-12 shadow-xl outline-none rounded-xl origin-top transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                {tabs.map((tab) => {
                  const isActive =
                    tab.href === basePath ? pathname === basePath : pathname.startsWith(tab.href);

                  return (
                    <Menu.Item
                      key={tab.href}
                      render={<NextLink href={tab.href} />}
                      className={twMerge(
                        'flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none transition-colors',
                        'data-[highlighted]:bg-plum-9 data-[highlighted]:text-white',
                        isActive &&
                          'bg-plum-3 text-plum-11 data-[highlighted]:bg-plum-9 data-[highlighted]:text-white',
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </Menu.Item>
                  );
                })}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>

      {/* Desktop Tabs */}
      <nav className="hidden md:flex gap-1 border-b border-sage-6">
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
                'flex items-center shrink-0 whitespace-nowrap gap-1.5 px-4 py-2 text-sm font-medium rounded-t-md -mb-px',
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
    </div>
  );
}
