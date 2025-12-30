import { ComponentPropsWithRef } from 'react';
import { Button as BaseButton } from '@base-ui/react/button';
import { twMerge } from 'tailwind-merge';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  loading?: boolean;
  loadingLabel?: string;
  loaderClassName?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'danger';
};

export default function Button({
  loading,
  loadingLabel,
  loaderClassName,
  children,
  className,
  size = 'md',
  disabled,
  variant = 'default',
  ...rest
}: ButtonProps) {
  return (
    <BaseButton
      focusableWhenDisabled
      disabled={loading || disabled}
      className={twMerge(
        DefaultTransitionStyles,
        FocusResetStyles,
        ShowFocusOnKeyboardStyles,
        'flex items-center justify-center gap-2',
        'cursor-pointer rounded-xl py-1 px-2 shadow shadow-black-a5 min-h-[calc(1lh+var(--spacing)*2)] min-w-[calc(1lh+var(--spacing)*4)]',

        'bg-sage-5 text-sage-12',
        !disabled && !loading && 'hover:bg-sage-7',

        variant === 'danger' && 'bg-ruby-5 text-ruby-12',
        !disabled && !loading && variant === 'danger' && 'hover:bg-ruby-7',

        size === 'sm' && 'text-sm',
        size === 'lg' && 'text-lg py-2 px-3 min-h-[calc(1lh+var(--spacing)*4)]',
        disabled && 'opacity-60 cursor-not-allowed',
        className,
        loading && 'animate-pulse cursor-wait',
        loading && loaderClassName,
      )}
      aria-label={loading ? loadingLabel || 'loading' : undefined}
      {...rest}
    >
      {children}
    </BaseButton>
  );
}
