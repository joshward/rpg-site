import * as React from 'react';
import { ComponentPropsWithRef } from 'react';
import { twMerge } from 'tailwind-merge';
import {
  DefaultTransitionStyles,
  FocusResetStyles,
  ShowFocusOnKeyboardStyles,
} from '@/styles/common';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, ...rest }, ref) => {
    return (
      <textarea
        ref={ref}
        disabled={disabled}
        className={twMerge(
          DefaultTransitionStyles,
          FocusResetStyles,
          ShowFocusOnKeyboardStyles,
          'flex min-h-[120px] w-full items-start justify-start gap-2',
          'rounded-xl border border-sage-6 bg-sage-2 px-3 py-1.5 text-sage-12 shadow-sm',
          'placeholder:text-sage-9',
          'hover:border-sage-8',
          'focus-visible:border-plum-8 focus-visible:ring-plum-8',
          disabled && 'cursor-not-allowed opacity-60 bg-sage-3 border-sage-5',
          className,
        )}
        {...rest}
      />
    );
  },
);

Textarea.displayName = 'Textarea';

export default Textarea;
