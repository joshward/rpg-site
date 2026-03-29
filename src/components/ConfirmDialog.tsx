'use client';

import * as React from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { twMerge } from 'tailwind-merge';
import Button, { type ButtonProps } from '@/components/Button';
import { DefaultTransitionStyles } from '@/styles/common';

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children?: React.ReactNode;
  confirmLabel?: string;
  confirmVariant?: ButtonProps['variant'];
  onConfirm: () => void;
}

export default function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  confirmVariant = 'default',
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={twMerge(DefaultTransitionStyles, 'fixed inset-0 bg-black-a8 z-50')}
        />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={twMerge(
              'bg-sage-2 rounded-xl shadow-lg p-6 w-full max-w-sm',
              'flex flex-col gap-4',
            )}
          >
            <AlertDialog.Title className="text-lg font-bold text-sage-12">
              {title}
            </AlertDialog.Title>
            {description && (
              <AlertDialog.Description className="text-sm text-sage-11">
                {description}
              </AlertDialog.Description>
            )}
            {children}
            <div className="flex justify-end gap-2 mt-2">
              <AlertDialog.Close render={<Button size="sm">Cancel</Button>} />
              <Button
                size="sm"
                variant={confirmVariant}
                onClick={() => {
                  onConfirm();
                  onOpenChange(false);
                }}
              >
                {confirmLabel}
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
