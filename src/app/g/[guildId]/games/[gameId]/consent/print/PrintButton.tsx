'use client';

import { FileTextIcon } from '@radix-ui/react-icons';
import Button from '@/components/Button';

/** No consent data or private-detail actions enter this client component. */
export default function PrintButton() {
  return (
    <Button type="button" className="print:hidden" onClick={() => window.print()}>
      <FileTextIcon aria-hidden="true" />
      Print / save PDF
    </Button>
  );
}
