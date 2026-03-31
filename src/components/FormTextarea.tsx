import * as React from 'react';
import { Field } from '@base-ui/react/field';
import Textarea, { TextareaProps } from './Textarea';
import { FormField, FormFieldProps } from './FormField';

export interface FormTextareaProps extends Omit<
  FormFieldProps,
  'children' | 'onChange' | 'onBlur'
> {
  textareaProps?: TextareaProps;
  placeholder?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  name?: string;
}

export const FormTextarea = React.forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  (
    {
      label,
      description,
      error,
      textareaProps,
      placeholder,
      value,
      onChange,
      onBlur,
      name,
      ...props
    },
    ref,
  ) => {
    return (
      <FormField label={label} description={description} error={error} {...props}>
        <Field.Control
          render={
            <Textarea
              ref={ref}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              name={name}
              {...textareaProps}
            />
          }
        />
      </FormField>
    );
  },
);

FormTextarea.displayName = 'FormTextarea';
