import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import { twMerge } from 'tailwind-merge';

export interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

const MarkdownPreview: React.FC<MarkdownPreviewProps> = ({ content, className }) => {
  return (
    <div
      className={twMerge(
        'prose prose-sage max-w-none text-sage-12',
        'prose-headings:text-sage-12 prose-headings:font-bold',
        'prose-p:text-sage-12',
        'prose-li:text-sage-12',
        'prose-strong:text-sage-12',
        className,
      )}
    >
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
};

export default MarkdownPreview;
