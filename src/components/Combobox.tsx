'use client';

import * as React from 'react';
import { Combobox } from '@base-ui/react/combobox';
import { twMerge } from 'tailwind-merge';
import { DefaultTransitionStyles, FocusResetStyles } from '@/styles/common';
import { CheckIcon, ChevronDownIcon, Cross1Icon } from '@radix-ui/react-icons';

export interface ComboboxOption {
  id: string | number;
  label: string;
}

export interface ComboboxProps<T extends ComboboxOption, M extends boolean = false> {
  items: T[];
  value?: M extends true ? T[] : T | null;
  onValueChange?: (value: M extends true ? T[] : T | null) => void;
  multiple?: M;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function ComboBox<T extends ComboboxOption, M extends boolean = false>({
  items,
  value,
  onValueChange,
  multiple,
  placeholder,
  disabled,
  className,
  size = 'md',
}: ComboboxProps<T, M>) {
  const id = React.useId();
  const containerRef = React.useRef<HTMLDivElement>(null);

  return (
    <Combobox.Root
      items={items}
      multiple={multiple}
      value={value as any}
      onValueChange={onValueChange as any}
      disabled={disabled}
      isItemEqualToValue={(itemValue, selectedValue) => itemValue?.id === selectedValue?.id}
    >
      <div className={twMerge('flex flex-col gap-1.5', className)}>
        <div
          ref={containerRef}
          className={twMerge(
            DefaultTransitionStyles,
            FocusResetStyles,
            'group flex flex-wrap items-center gap-1 rounded-xl border border-sage-6 bg-sage-2 px-3 py-1.5 shadow-sm min-h-[42px]',
            'focus-within:border-plum-8 focus-within:ring-1 focus-within:ring-plum-8',
            'hover:border-sage-8',
            size === 'sm' && 'px-2 py-1 min-h-[34px]',
            size === 'lg' && 'px-4 py-2 min-h-[50px]',
            disabled && 'cursor-not-allowed opacity-60 bg-sage-3 border-sage-5',
          )}
        >
          {multiple ? (
            <Combobox.Chips className="flex flex-wrap items-center gap-1 flex-1">
              <Combobox.Value>
                {(selectedItems: T[]) => (
                  <React.Fragment>
                    {selectedItems.map((item) => (
                      <Combobox.Chip
                        key={item.id}
                        className="flex items-center gap-1 rounded-md bg-plum-3 px-1.5 py-0.5 text-xs font-medium text-plum-11 outline-none data-[highlighted]:bg-plum-4"
                      >
                        {item.label}
                        <Combobox.ChipRemove className="rounded-sm p-0.5 hover:bg-plum-5 transition-colors">
                          <Cross1Icon className="size-3" />
                        </Combobox.ChipRemove>
                      </Combobox.Chip>
                    ))}
                    <Combobox.Input
                      id={id}
                      placeholder={selectedItems.length === 0 ? placeholder : ''}
                      className={twMerge(
                        'min-w-[60px] flex-1 bg-transparent text-sm text-sage-12 outline-none placeholder:text-sage-9 disabled:cursor-not-allowed',
                        size === 'sm' && 'text-xs',
                        size === 'lg' && 'text-base',
                      )}
                    />
                  </React.Fragment>
                )}
              </Combobox.Value>
            </Combobox.Chips>
          ) : (
            <React.Fragment>
              <Combobox.Input
                id={id}
                placeholder={placeholder}
                className={twMerge(
                  'flex-1 bg-transparent text-sm text-sage-12 outline-none placeholder:text-sage-9 disabled:cursor-not-allowed',
                  size === 'sm' && 'text-xs',
                  size === 'lg' && 'text-base',
                )}
              />
            </React.Fragment>
          )}

          <Combobox.Trigger className="text-sage-9 group-hover:text-sage-11 transition-colors">
            <ChevronDownIcon className="size-4" />
          </Combobox.Trigger>
        </div>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={8} anchor={containerRef}>
          <Combobox.Popup className="w-[var(--anchor-width)] max-h-60 origin-[var(--transform-origin)] overflow-y-auto rounded-xl bg-sage-1 border border-sage-4 p-1 text-sage-12 shadow-xl outline-none transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <Combobox.Empty className="px-3 py-2 text-sm text-sage-9">
              No results found.
            </Combobox.Empty>
            <Combobox.List>
              {(item: T) => (
                <Combobox.Item
                  key={item.id}
                  value={item}
                  className={twMerge(
                    'flex cursor-default items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm outline-none select-none',
                    'data-[highlighted]:bg-plum-9 data-[highlighted]:text-white',
                    'data-[selected]:bg-plum-3 data-[selected]:text-plum-11 data-[selected]:data-[highlighted]:bg-plum-9 data-[selected]:data-[highlighted]:text-white',
                    'transition-colors',
                  )}
                >
                  {item.label}
                  <Combobox.ItemIndicator>
                    <CheckIcon className="size-4" />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
