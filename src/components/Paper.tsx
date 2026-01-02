import { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface PaperProps {
  children?: ReactNode;
  className?: string;
}

export default function Paper({ children, className }: PaperProps) {
  return (
    <div className={twMerge('flex flex-col gap-4 p-6 bg-sage-5/30 rounded-md shadow', className)}>
      {children}
    </div>
  );
}
