import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
  /** Disable image requests for privacy-sensitive consent content. */
  allowImages?: boolean;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({
  content,
  className,
  allowImages = true,
}) => {
  return (
    <div
      className={twMerge(
        'prose prose-sage max-w-none text-sage-12 dark:prose-invert',
        'prose-headings:text-sage-12 prose-headings:font-bold',
        className,
      )}
    >
      <ReactMarkdown
        components={allowImages ? undefined : { img: ({ alt }) => <span>{alt}</span> }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
