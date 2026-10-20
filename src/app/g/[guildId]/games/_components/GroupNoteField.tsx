'use client';

import { useState, type FormEvent } from 'react';
import { Pencil2Icon } from '@radix-ui/react-icons';
import { getGameConsentGroupNote, saveGameConsentGroupNote } from '@/actions/consent-group-notes';
import { isFailure } from '@/actions/result';
import type { ConsentGroupNote } from '@/lib/consent/group-notes';
import Button from '@/components/Button';
import Alert from '@/components/Alert';
import { FormTextarea } from '@/components/FormTextarea';

export default function GroupNoteField({
  guildId,
  gameId,
  topicId,
  label,
  value,
  canEdit,
  onSaved,
}: {
  guildId: string;
  gameId: string;
  topicId: string | null;
  label: string;
  value: ConsentGroupNote;
  canEdit: boolean;
  onSaved: (value: ConsentGroupNote) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [baseline, setBaseline] = useState('');
  const [revision, setRevision] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit || pending) return;
    setPending(true);
    setError(null);
    try {
      const result = await saveGameConsentGroupNote(guildId, gameId, topicId, draft, revision);
      if (isFailure(result)) {
        setError(result.error);
        return;
      }
      onSaved(result.data);
      setEditing(false);
      setSaved(true);
    } catch {
      setError('Could not save the group note. Your draft has been kept.');
    } finally {
      setPending(false);
    }
  }

  function startEditing() {
    setDraft(value.note);
    setBaseline(value.note);
    setRevision(value.revision);
    setEditing(true);
    setError(null);
    setSaved(false);
  }

  if (!value.note && !canEdit) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {value.note && (
        <p className="whitespace-pre-wrap break-words text-sm">
          <Pencil2Icon aria-hidden="true" className="mr-1 inline size-4 text-violet-11" />
          {value.note}
          {canEdit && !editing && (
            <Button
              type="button"
              size="sm"
              className="print:hidden ml-1 inline-flex min-h-0 min-w-0 rounded-md p-1 align-middle"
              onClick={startEditing}
              aria-label={`Edit ${label}`}
              title={`Edit ${label}`}
            >
              <Pencil2Icon aria-hidden="true" className="size-4" />
            </Button>
          )}
        </p>
      )}
      {canEdit &&
        (editing ? (
          <form
            onSubmit={submit}
            className="print:hidden flex flex-col gap-3 rounded-lg text-left border border-violet-7 bg-violet-2 p-3"
          >
            <FormTextarea
              label={label}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              textareaProps={{ maxLength: 10000, rows: 4 }}
              description="This is shared group-facing text, not a private player note. All members of Requested games can read it. Translate private context deliberately; nothing is copied automatically. Locking private mode discards unsaved edits."
            />
            {error && <Alert type="error">{error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={pending || draft === baseline}
                loading={pending}
              >
                Save group note
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setEditing(false);
                  setError(null);
                }}
              >
                Cancel
              </Button>
              {error && (
                <Button
                  type="button"
                  size="sm"
                  disabled={pending}
                  onClick={async () => {
                    setPending(true);
                    try {
                      const result = await getGameConsentGroupNote(guildId, gameId, topicId);
                      if (isFailure(result)) {
                        setError(result.error);
                        return;
                      }
                      onSaved(result.data);
                      setDraft(result.data.note);
                      setBaseline(result.data.note);
                      setRevision(result.data.revision);
                      setError(null);
                    } catch {
                      setError('Could not reload the group note. Your draft has been kept.');
                    } finally {
                      setPending(false);
                    }
                  }}
                >
                  Reload latest (discard draft)
                </Button>
              )}
            </div>
          </form>
        ) : (
          <div className="print:hidden">
            {!value.note && (
              <Button
                type="button"
                size="sm"
                className="inline-flex"
                onClick={startEditing}
                aria-label={`Add ${label}`}
              >
                <Pencil2Icon aria-hidden="true" />
                Add group note
              </Button>
            )}
            {saved && <output className="ml-2 text-sm text-jade-11">Group note saved.</output>}
          </div>
        ))}
    </div>
  );
}
