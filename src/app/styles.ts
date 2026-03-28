import { Inter, Fraunces } from 'next/font/google';
import './globals.css';
import { twJoin } from 'tailwind-merge';

const interSans = Inter({
  variable: '--font-inter-sans',
  subsets: ['latin'],
});

const frauncesSerif = Fraunces({
  variable: '--font-fraunces-serif',
  subsets: ['latin'],
});

export const fontStyles = `${interSans.variable} ${frauncesSerif.variable}`;

export const baseStyles = twJoin(
  'bg-mauve-1 text-slate-11 selection:bg-plum-9 selection:text-white',
  'font-sans antialiased',
);
