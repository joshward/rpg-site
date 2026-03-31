import * as React from 'react';
import { Field } from '@base-ui/react/field';
import Input, { InputProps } from './Input';
import { FormField, FormFieldProps } from './FormField';

export interface FormInputProps extends Omit<FormFieldProps, 'children' | 'onChange' | 'onBlur'> {
  inputProps?: InputProps;
  placeholder?: string;
  value?: string | number;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  name?: string;
}

/**
 * A FormInput component that combines FormField with Input.
 * It is designed to be used as a standalone component or within a TanStack Form Field.
 */
export const FormInput = React.forwardRef<HTMLInputElement, FormInputProps>(
  (
    { label, description, error, inputProps, placeholder, value, onChange, onBlur, name, ...props },
    ref,
  ) => {
    return (
      <FormField label={label} description={description} error={error} {...props}>
        <Field.Control
          render={
            <Input
              ref={ref}
              placeholder={placeholder}
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              name={name}
              {...inputProps}
            />
          }
        />
      </FormField>
    );
  },
);

FormInput.displayName = 'FormInput';
