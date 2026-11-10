'use client';

import { useEffect, useRef, type ReactNode } from 'react';

/** Retry hash scrolling after the asynchronously loaded checklist has mounted. */
export default function ChecklistSection({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const frame = useRef<number | undefined>(undefined);
  useEffect(() => {
    const scrollToChecklist = () => {
      if (window.location.hash !== '#content-checklist') return;
      frame.current = requestAnimationFrame(() => ref.current?.scrollIntoView({ block: 'start' }));
    };
    scrollToChecklist();
    window.addEventListener('hashchange', scrollToChecklist);
    return () => {
      if (frame.current !== undefined) cancelAnimationFrame(frame.current);
      window.removeEventListener('hashchange', scrollToChecklist);
    };
  }, []);
  return (
    <section
      ref={ref}
      id="content-checklist"
      aria-label="Content Checklist"
      className="scroll-mt-4"
    >
      {children}
    </section>
  );
}
