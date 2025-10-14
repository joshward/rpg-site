import type { Metadata } from 'next';
import { Inter, Fraunces } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { twJoin } from 'tailwind-merge';
import { MainHeader } from './MainHeader';
import './globals.css';

const interSans = Inter({
  variable: '--font-inter-sans',
  subsets: ['latin'],
});

const frauncesSerif = Fraunces({
  variable: '--font-fraunces-serif',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'RPG Tavern',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${interSans.variable} ${frauncesSerif.variable}`}
    >
      <body
        className={twJoin(
          'relative flex flex-col gap-4 min-h-screen min-w-[300px]',
          'bg-mauve-1 text-slate-11 selection:bg-plum-9 selection:text-white',
          'font-sans antialiased',
        )}
      >
        <ThemeProvider attribute="class" enableSystem>
          <div className="from-violet-8 dark:from-violet-4 absolute top-0 right-0 left-0 -z-50 h-[300px] w-full bg-gradient-to-b to-transparent" />
          <MainHeader />

          <div className="grow flex flex-col items-center px-2 md:px-6">
            <div className="w-full md:max-w-[80rem]">{children}</div>
          </div>

          <footer>FOOTER TODO</footer>
        </ThemeProvider>
      </body>
    </html>
  );
}
