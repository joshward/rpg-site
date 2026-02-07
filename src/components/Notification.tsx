'use client';

import * as React from 'react';
import { Toast } from '@base-ui/react/toast';
import { twMerge } from 'tailwind-merge';
import {
  CrossCircledIcon,
  ExclamationTriangleIcon,
  CheckCircledIcon,
  InfoCircledIcon,
  Cross2Icon,
} from '@radix-ui/react-icons';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationData {
  type?: NotificationType;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

export const useNotification = () => {
  const toastManager = Toast.useToastManager();

  return React.useMemo(
    () => ({
      ...toastManager,
      add: (data: NotificationData) => {
        return toastManager.add({
          title: data.title,
          description: data.description,
          data: { type: data.type || 'info' },
        });
      },
    }),
    [toastManager],
  );
};

export interface NotificationProps {
  toast?: any;
  type?: NotificationType;
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

const typeStyles: Record<NotificationType, string> = {
  info: 'bg-sage-5 text-sage-12 border-sage-7',
  success: 'bg-plum-5 text-plum-12 border-plum-7',
  warning: 'bg-amber-5 text-amber-12 border-amber-7',
  error: 'bg-ruby-5 text-ruby-12 border-ruby-7',
};

const typeIcons: Record<NotificationType, React.ReactNode> = {
  info: <InfoCircledIcon />,
  success: <CheckCircledIcon />,
  warning: <ExclamationTriangleIcon />,
  error: <CrossCircledIcon />,
};

/**
 * A notification component built on Base UI Toast.
 * It provides a standard way of passing title and body with different styles based on type.
 */
export default function Notification({
  toast,
  type = 'info',
  title,
  children,
  className,
}: NotificationProps) {
  if (!toast) return null;
  return (
    <Toast.Root
      toast={toast}
      className={twMerge(
        'relative flex w-80 flex-col gap-2 rounded-lg border p-4 shadow-lg transition-all',
        'data-[starting-style]:opacity-0 data-[starting-style]:scale-95',
        'data-[ending-style]:opacity-0 data-[ending-style]:scale-95',
        typeStyles[type],
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0 text-lg">{typeIcons[type]}</div>
        <div className="flex-1 overflow-hidden">
          {title && <Toast.Title className="font-bold leading-tight">{title}</Toast.Title>}
          {children && (
            <Toast.Description className="mt-1 text-sm opacity-90">{children}</Toast.Description>
          )}
        </div>
        <Toast.Close
          className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100 hover:bg-black-a3 focus:outline-none focus:ring-2 focus:ring-plum-8 transition-colors"
          aria-label="Close"
        >
          <Cross2Icon />
        </Toast.Close>
      </div>
    </Toast.Root>
  );
}

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <Toast.Provider>
      {children}
      <NotificationList />
    </Toast.Provider>
  );
};

const NotificationList = () => {
  const { toasts } = Toast.useToastManager();
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed right-4 bottom-4 z-50 flex flex-col gap-2 outline-none">
        {toasts.map((toast: any) => (
          <Notification
            key={toast.id}
            toast={toast}
            type={toast.data?.type as NotificationType}
            title={toast.title}
          >
            {toast.description}
          </Notification>
        ))}
      </Toast.Viewport>
    </Toast.Portal>
  );
};
