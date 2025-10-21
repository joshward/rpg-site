import { ComponentPropsWithRef } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  asLoader?: boolean;
  loaderClassName?: string;
  size?: 'sm' | 'md' | 'lg';
};

export default function Button({
  asLoader,
  loaderClassName,
  children,
  className,
  size = 'md',
  ...rest
}: ButtonProps) {
  if (asLoader) {
    return (
      <div
        className={twMerge(
          'p-1 w-25 bg-sage-5 rounded-xl shadow shadow-black-a5 animate-pulse min-w-[calc(1lh+var(--spacing)*4)]',
          size === 'sm' && 'text-sm',
          size === 'lg' && 'text-lg py-2 px-3',
          className,
          loaderClassName,
        )}
      >
        &nbsp;
      </div>
    );
  }

  return (
    <button
      className={twMerge(
        DefaultTransitionStyles,
        FocusResetStyles,
        ShowFocusOnKeyboardStyles,
        'flex items-center justify-center gap-2',
        'bg-sage-5 hover:bg-sage-7 text-sage-12 cursor-pointer rounded-xl py-1 px-2 shadow shadow-black-a5 min-h-[calc(1lh+var(--spacing)*2)] min-w-[calc(1lh+var(--spacing)*4)]',
        size === 'sm' && 'text-sm',
        size === 'lg' && 'text-lg py-2 px-3 min-h-[calc(1lh+var(--spacing)*4)]',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
