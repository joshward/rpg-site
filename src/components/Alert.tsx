import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { CrossCircledIcon, ExclamationTriangleIcon } from '@radix-ui/react-icons';

export interface AlertProps {
  type: 'error' | 'warning';
  children?: ReactNode;
  className?: string;
}

export default function Alert({ type, children, className }: AlertProps) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-2 p-4 rounded-md font-bold',
        type === 'error' && 'bg-ruby-5 text-ruby-12',
        type === 'warning' && 'bg-amber-5 text-amber-12',
        className,
      )}
    >
      {type === 'error' && <CrossCircledIcon />}
      {type === 'warning' && <ExclamationTriangleIcon />}
      <div>{children}</div>
    </div>
  );
}
