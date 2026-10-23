'use client';

import { forwardRef, useId, useState, type FocusEventHandler } from 'react';
import { twMerge } from 'tailwind-merge';
import Textarea from './Textarea';
import MarkdownPreview from './MarkdownPreview';
import Switch from './Switch';

export interface MarkdownEditorProps {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  description?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  id?: string;
  name?: string;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  onBlur?: FocusEventHandler<HTMLTextAreaElement>;
  allowImages?: boolean;
  className?: string;
}

/** Controlled text stays with the caller; previewing neither saves nor changes it. */
const MarkdownEditor = forwardRef<HTMLTextAreaElement, MarkdownEditorProps>(function MarkdownEditor(
  {
    label,
    value,
    onValueChange,
    description,
    error,
    disabled,
    readOnly,
    id,
    name,
    placeholder,
    maxLength,
    rows = 5,
    onBlur,
    allowImages = false,
    className,
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [preview, setPreview] = useState(false);
  const describedBy =
    [description ? `${inputId}-description` : null, error ? `${inputId}-error` : null]
      .filter(Boolean)
      .join(' ') || undefined;
  return (
    <div className={twMerge('flex min-w-0 flex-col gap-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label
          id={`${inputId}-label`}
          htmlFor={preview ? undefined : inputId}
          className="text-sm font-medium text-sage-12"
        >
          {label}
        </label>
        <Switch
          label="Preview"
          aria-label={`Preview ${label}`}
          checked={preview}
          onCheckedChange={setPreview}
          disabled={disabled}
        />
      </div>
      {description && (
        <p id={`${inputId}-description`} className="text-xs text-sage-11">
          {description}
        </p>
      )}
      {preview && name && <input type="hidden" name={name} value={value} disabled={disabled} />}
      {preview ? (
        <section
          aria-labelledby={`${inputId}-label`}
          aria-describedby={describedBy}
          className="min-h-[120px] rounded-xl border border-sage-6 bg-sage-2 p-3"
        >
          {value ? (
            <MarkdownPreview content={value} allowImages={allowImages} />
          ) : (
            <p className="text-sm italic text-sage-11">Nothing to preview yet.</p>
          )}
        </section>
      ) : (
        <Textarea
          ref={ref}
          id={inputId}
          name={name}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          readOnly={readOnly}
          placeholder={placeholder}
          maxLength={maxLength}
          rows={rows}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
        />
      )}
      <p className="text-xs text-sage-11">
        Supports headings, emphasis, lists and links.
        {!allowImages && ' Images are shown as alt text, without loading them.'}
      </p>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs font-medium text-ruby-11">
          {error}
        </p>
      )}
    </div>
  );
});

export default MarkdownEditor;
