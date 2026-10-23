import type { ReactNode } from 'react';
import { Pencil2Icon } from '@radix-ui/react-icons';
import { twMerge } from 'tailwind-merge';
import MarkdownPreview from '@/components/MarkdownPreview';

/** Shared consent text has one rendering policy in the overview and print view.
 * Images become alt text so merely reading a note cannot contact a remote host. */
export default function GroupNoteContent({
  note,
  children,
  className,
}: {
  note: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={twMerge('text-sm', className)}>
      <div className="inline-flex max-w-full items-start gap-1 align-top">
        <Pencil2Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-violet-11" />
        <MarkdownPreview
          content={note}
          allowImages={false}
          className="prose-sm min-w-0 break-words text-left [&>:first-child]:mt-0 [&>:last-child]:mb-0 [&_p]:whitespace-pre-wrap"
        />
        {children}
      </div>
    </div>
  );
}
