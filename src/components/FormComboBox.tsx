import * as React from 'react';
import { Field } from '@base-ui/react/field';
import ComboBox, { ComboboxProps, ComboboxOption } from './Combobox';
import { FormField, FormFieldProps } from './FormField';

export interface FormComboBoxProps<
  T extends ComboboxOption,
  M extends boolean = false,
> extends Omit<FormFieldProps, 'children' | 'value' | 'onValueChange'> {
  items: T[];
  value?: M extends true ? T[] : T | null;
  onValueChange?: (value: M extends true ? T[] : T | null) => void;
  multiple?: M;
  placeholder?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  comboProps?: Partial<ComboboxProps<T, M>>;
}

export const FormComboBox = React.forwardRef<HTMLDivElement, FormComboBoxProps<any, any>>(
  (
    {
      label,
      description,
      error,
      items,
      value,
      onValueChange,
      multiple,
      placeholder,
      disabled,
      size,
      comboProps,
      ...props
    },
    ref,
  ) => {
    return (
      <FormField
        ref={ref}
        label={label}
        description={description}
        error={error}
        disabled={disabled}
        {...props}
      >
        <Field.Control
          render={
            <ComboBox
              items={items}
              value={value}
              onValueChange={onValueChange}
              multiple={multiple}
              placeholder={placeholder}
              disabled={disabled}
              size={size}
              {...comboProps}
            />
          }
        />
      </FormField>
    );
  },
) as <T extends ComboboxOption, M extends boolean = false>(
  props: FormComboBoxProps<T, M> & { ref?: React.ForwardedRef<HTMLDivElement> },
) => React.ReactElement;

// @ts-ignore
FormComboBox.displayName = 'FormComboBox';
