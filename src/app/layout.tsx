import { ReactNode } from 'react';
import type { Metadata } from 'next';
import { ThemeProvider } from 'next-themes';
import { twJoin } from 'tailwind-merge';
import { MainHeader } from './MainHeader';
import { getDefaultMetadata } from '@/lib/metadata';
import { fontStyles, baseStyles } from '@/app/styles';
import { NotificationProvider } from '@/components/Notification';

export const metadata: Metadata = getDefaultMetadata();

export default async function RootLayout({
  children,
  guildBadge,
}: Readonly<{
  children: ReactNode;
  guildBadge: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={fontStyles}>
      <body className={twJoin('relative', baseStyles)}>
        <div className="flex flex-col gap-4 min-h-screen min-w-75 isolate">
          <ThemeProvider attribute="class" enableSystem>
            <NotificationProvider>
              <div className="from-violet-8 dark:from-violet-4 absolute top-0 right-0 left-0 -z-50 h-75 w-full bg-linear-to-b to-transparent" />
              <MainHeader guildBadge={guildBadge} />

              <div className="grow flex flex-col items-center px-2 md:px-6">
                <div className="w-full md:max-w-7xl">{children}</div>
              </div>
            </NotificationProvider>
          </ThemeProvider>
        </div>
      </body>
    </html>
  );
}
