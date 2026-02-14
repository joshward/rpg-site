import { ComponentPropsWithRef } from 'react';
import { Input as BaseInput } from '@base-ui/react/input';
import { twMerge } from 'tailwind-merge';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

export interface InputProps extends Omit<ComponentPropsWithRef<'input'>, 'size'> {
  size?: 'sm' | 'md' | 'lg';
}

export default function Input({ className, size = 'md', disabled, ...rest }: InputProps) {
  return (
    <BaseInput
      disabled={disabled}
      className={twMerge(
        DefaultTransitionStyles,
        FocusResetStyles,
        ShowFocusOnKeyboardStyles,
        'flex w-full items-center justify-center gap-2',
        'rounded-xl border border-sage-6 bg-sage-2 px-3 py-1.5 text-sage-12 shadow-sm',
        'placeholder:text-sage-9',
        'hover:border-sage-8',
        'focus-visible:border-plum-8 focus-visible:ring-plum-8',
        size === 'sm' && 'text-sm px-2 py-1',
        size === 'lg' && 'text-lg px-4 py-2',
        disabled && 'cursor-not-allowed opacity-60 bg-sage-3 border-sage-5',
        className,
      )}
      {...rest}
    />
  );
}
