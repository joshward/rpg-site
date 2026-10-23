'use client';

import { forwardRef, useId, type ReactNode } from 'react';
import { Switch as BaseSwitch } from '@base-ui/react/switch';
import { twMerge } from 'tailwind-merge';
import { ShowFocusOnKeyboardStyles } from '@/styles/common';

export interface SwitchProps extends Omit<
  BaseSwitch.Root.Props,
  'children' | 'className' | 'render' | 'nativeButton'
> {
  label: ReactNode;
  description?: string;
  className?: string;
}

/** A labelled boolean control; changing it never submits its surrounding form. */
const Switch = forwardRef<HTMLElement, SwitchProps>(function Switch(
  {
    label,
    description,
    className,
    disabled,
    'aria-label': ariaLabel,
    'aria-labelledby': labelledBy,
    'aria-describedby': describedBy,
    ...props
  },
  ref,
) {
  const id = useId();
  return (
    <label
      className={twMerge(
        'inline-flex w-fit cursor-pointer items-center gap-3 text-sm text-sage-12',
        disabled && 'cursor-not-allowed opacity-60',
        className,
      )}
    >
      <BaseSwitch.Root
        {...props}
        ref={ref}
        disabled={disabled}
        aria-labelledby={labelledBy ?? (ariaLabel ? `${id}-accessible-label` : `${id}-label`)}
        aria-describedby={
          [description ? `${id}-description` : undefined, describedBy].filter(Boolean).join(' ') ||
          undefined
        }
        className={twMerge(
          ShowFocusOnKeyboardStyles,
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-sage-8 bg-sage-5 p-0.5 transition-colors data-checked:border-violet-9 data-checked:bg-violet-9 data-disabled:cursor-not-allowed motion-reduce:transition-none',
        )}
      >
        <BaseSwitch.Thumb className="block size-4.5 rounded-full bg-white shadow-sm transition-transform data-checked:translate-x-5 motion-reduce:transition-none" />
      </BaseSwitch.Root>
      {ariaLabel && (
        <span id={`${id}-accessible-label`} className="sr-only">
          {ariaLabel}
        </span>
      )}
      <span className="flex flex-col gap-1">
        <span id={`${id}-label`}>{label}</span>
        {description && (
          <span id={`${id}-description`} className="text-xs text-sage-11">
            {description}
          </span>
        )}
      </span>
    </label>
  );
});

export default Switch;
