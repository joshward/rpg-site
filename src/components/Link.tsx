import NextLink from 'next/link';
import { ComponentPropsWithRef } from 'react';
import { twMerge } from 'tailwind-merge';
import { FocusResetStyles, ShowFocusOnKeyboardStyles } from '@/styles/common';

type NextLinkProps = ComponentPropsWithRef<typeof NextLink>;

export default function Link({ className, ...props }: NextLinkProps) {
  return (
    <NextLink
      className={twMerge(
        FocusResetStyles,
        ShowFocusOnKeyboardStyles,
        'text-violet-11 cursor-pointer hover:text-violet-12 hover:underline',
        className,
      )}
      {...props}
    />
  );
}
