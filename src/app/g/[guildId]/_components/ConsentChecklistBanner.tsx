import { ClipboardIcon } from '@radix-ui/react-icons';
import Alert from '@/components/Alert';
import Link from '@/components/Link';

export default function ConsentChecklistBanner({ guildId }: { guildId: string }) {
  return (
    <Alert type="info">
      <div className="flex flex-col items-start gap-3">
        <p>One or more of the games you&apos;re in request a completed content checklist.</p>
        <Link
          href={`/g/${guildId}/preferences#content-checklist`}
          className="inline-flex w-fit items-center gap-2 rounded-xl border border-violet-7 bg-violet-3 px-3 py-2 text-sm font-medium hover:bg-violet-4 hover:no-underline"
        >
          <ClipboardIcon aria-hidden="true" className="size-4" />
          Please complete your checklist.
        </Link>
      </div>
    </Alert>
  );
}
