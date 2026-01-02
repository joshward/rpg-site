import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { ExclamationTriangleIcon } from '@radix-ui/react-icons';

export interface AlertProps {
  type: 'error';
  children?: ReactNode;
  className?: string;
}

export default function Alert({ type, children, className }: AlertProps) {
  return (
    <div
      className={twMerge(
        'flex flex-row items-center gap-2 p-4 rounded-md font-bold',
        type === 'error' && 'bg-ruby-5 text-ruby-12',
        className,
      )}
    >
      {type === 'error' && <ExclamationTriangleIcon />}
      <div>{children}</div>
    </div>
  );
}
