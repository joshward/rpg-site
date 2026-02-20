import * as React from 'react';
import { Field } from '@base-ui/react/field';
import { twMerge } from 'tailwind-merge';

export interface FormFieldProps extends Field.Root.Props {
  label?: string;
  description?: string;
  error?: string;
  children: React.ReactNode;
}

/**
 * A reusable form field wrapper that provides labels, descriptions, and error messages
 * using @base-ui/react/field primitives.
 */
export function FormField({
  label,
  description,
  error,
  children,
  className,
  ...props
}: FormFieldProps) {
  return (
    <Field.Root
      className={twMerge(
        'flex flex-col gap-1.5',
        typeof className === 'function' ? undefined : className,
      )}
      {...props}
    >
      {label && <Field.Label className="text-sm font-medium text-sage-12">{label}</Field.Label>}

      {children}

      {description && (
        <Field.Description className="text-xs text-sage-11">{description}</Field.Description>
      )}

      <Field.Error match={!!error} className="text-xs font-medium text-ruby-11">
        {error}
      </Field.Error>
    </Field.Root>
  );
}
