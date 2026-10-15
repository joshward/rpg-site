'use client';

import { useState, type FormEvent } from 'react';
import {
  BellIcon,
  CrossCircledIcon,
  EyeClosedIcon,
  HeartFilledIcon,
  Pencil2Icon,
} from '@radix-ui/react-icons';
import {
  saveMyConsentChecklist,
  type ConsentResponseInput,
  type getMyConsentChecklist,
} from '@/actions/consent-checklist';
import { isFailure } from '@/actions/result';
import { missingConsentTopicIds } from '@/lib/consent/completeness';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import MarkdownPreview from '@/components/MarkdownPreview';
import { useNotification } from '@/components/Notification';

export type ChecklistData = Extract<
  Awaited<ReturnType<typeof getMyConsentChecklist>>,
  { type: 'success' }
>['data'];
type Topic = ChecklistData['topics'][number];
type Draft = Omit<ConsentResponseInput, 'expectedTopicRevision'> & { note: string };
const choices = [
  {
    value: 'enthusiastic',
    label: 'Enthusiastic consent',
    icon: HeartFilledIcon,
    active: 'bg-plum-9 text-white',
  },
  {
    value: 'veil',
    label: 'Veil (off-screen)',
    icon: EyeClosedIcon,
    active: 'bg-amber-9 text-white',
  },
  {
    value: 'line',
    label: 'Hard line (do not include)',
    icon: CrossCircledIcon,
    active: 'bg-ruby-9 text-white',
  },
] as const;

const toggleBase =
  'flex size-9 shrink-0 items-center justify-center rounded-md border border-sage-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-8 disabled:cursor-not-allowed disabled:opacity-40';
function toggleStyle(active: boolean, activeStyle: string) {
  return `${toggleBase} ${active ? activeStyle : 'bg-sage-2 text-sage-11 hover:bg-sage-4'}`;
}

function initialDrafts(checklist: ChecklistData): Record<string, Draft> {
  const responses = new Map(checklist.responses.map((response) => [response.topicId, response]));
  return Object.fromEntries(
    checklist.topics.map((topic) => {
      const response = responses.get(topic.id);
      return [
        topic.id,
        {
          answer: response?.answer ?? null,
          headsUp: response?.headsUp ?? false,
          note: response?.note ?? '',
        },
      ];
    }),
  );
}

function sameDraft(a: Draft, b: Draft) {
  return a.answer === b.answer && a.headsUp === b.headsUp && a.note === b.note;
}

export default function ChecklistForm({
  guildId,
  initialChecklist,
}: {
  guildId: string;
  initialChecklist: ChecklistData;
}) {
  const notification = useNotification();
  const [drafts, setDrafts] = useState(() => initialDrafts(initialChecklist));
  const [savedDrafts, setSavedDrafts] = useState(() => initialDrafts(initialChecklist));
  const [overallNote, setOverallNote] = useState(initialChecklist.overallNote ?? '');
  const [savedOverallNote, setSavedOverallNote] = useState(initialChecklist.overallNote ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [openNotes, setOpenNotes] = useState<Record<string, boolean>>({});
  const [overallNoteOpen, setOverallNoteOpen] = useState(false);
  const { topics, guidance } = initialChecklist;
  const dirtyTopics = topics.filter((topic) => !sameDraft(drafts[topic.id], savedDrafts[topic.id]));
  const isDirty = dirtyTopics.length > 0 || overallNote !== savedOverallNote;
  const missing = missingConsentTopicIds(
    topics,
    topics.map((topic) => ({ topicId: topic.id, answer: drafts[topic.id].answer })),
  );

  function updateDraft(topicId: string, update: Partial<Draft>) {
    setDrafts((current) => ({ ...current, [topicId]: { ...current[topicId], ...update } }));
    setSaved(false);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isDirty || saving) return;
    setError(null);
    setSaving(true);
    try {
      const result = await saveMyConsentChecklist(
        guildId,
        dirtyTopics.map((topic) => ({
          topicId: topic.id,
          expectedTopicRevision: topic.revision,
          ...drafts[topic.id],
        })),
        overallNote === savedOverallNote ? undefined : overallNote,
      );
      if (isFailure(result)) {
        setError(result.error);
        notification.add({
          type: 'error',
          title: 'Could not save checklist',
          description: result.error,
        });
        return;
      }
      setSavedDrafts(drafts);
      setSavedOverallNote(overallNote);
      setSaved(true);
      notification.add({ type: 'success', title: 'Checklist saved' });
    } finally {
      setSaving(false);
    }
  }

  function topicFields(topic: Topic) {
    const draft = drafts[topic.id];
    const canRequestHeadsUp = draft.answer === 'enthusiastic' || draft.answer === 'veil';
    const noteOpen = openNotes[topic.id] ?? false;
    return (
      <fieldset className="min-w-0 border-b border-sage-6 last:border-0">
        <legend className="sr-only">{topic.name}</legend>
        <div className="flex items-center gap-2 py-1">
          <span className="min-w-0 flex-1 text-sm font-medium text-sage-12">{topic.name}</span>
          <div className="flex shrink-0 items-center gap-1">
            {choices.map((choice) => {
              const Icon = choice.icon;
              const selected = draft.answer === choice.value;
              return (
                <button
                  key={choice.value}
                  type="button"
                  disabled={saving}
                  className={toggleStyle(selected, choice.active)}
                  aria-label={`${choice.label} for ${topic.name}`}
                  title={`${choice.label} for ${topic.name}`}
                  aria-pressed={selected}
                  onClick={() => {
                    const answer = selected ? null : choice.value;
                    updateDraft(topic.id, {
                      answer,
                      headsUp: draft.headsUp && (answer === 'enthusiastic' || answer === 'veil'),
                    });
                  }}
                >
                  <Icon aria-hidden="true" className="size-4" />
                </button>
              );
            })}
            <button
              type="button"
              disabled={saving || !canRequestHeadsUp}
              className={toggleStyle(draft.headsUp, 'bg-amber-9 text-white')}
              aria-label={`Heads-up for ${topic.name}`}
              title={
                canRequestHeadsUp
                  ? `Heads-up for ${topic.name}`
                  : 'Choose Enthusiastic consent or Veil to request a heads-up'
              }
              aria-pressed={draft.headsUp}
              onClick={() => updateDraft(topic.id, { headsUp: !draft.headsUp })}
            >
              <BellIcon aria-hidden="true" className="size-4" />
            </button>
            <button
              type="button"
              disabled={saving}
              className={toggleStyle(Boolean(draft.note), 'bg-violet-9 text-white')}
              aria-label={`${draft.note ? 'Edit' : 'Add'} private note for ${topic.name}`}
              title={`${draft.note ? 'Edit' : 'Add'} private note for ${topic.name}`}
              aria-expanded={noteOpen}
              aria-controls={noteOpen ? `note-panel-${topic.id}` : undefined}
              onClick={() => setOpenNotes((current) => ({ ...current, [topic.id]: !noteOpen }))}
            >
              <Pencil2Icon aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>
        {noteOpen && (
          <div id={`note-panel-${topic.id}`} className="pb-2">
            <label htmlFor={`note-${topic.id}`} className="block text-sm text-sage-11">
              Private note for {topic.name} (only consent coordinators in your games can read this)
            </label>
            <textarea
              id={`note-${topic.id}`}
              className="mt-1 w-full rounded-md border border-sage-7 bg-sage-1 p-2 text-sage-12"
              rows={3}
              maxLength={10000}
              disabled={saving}
              value={draft.note}
              onChange={(event) => updateDraft(topic.id, { note: event.target.value })}
            />
          </div>
        )}
      </fieldset>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <header className="sticky top-0 z-30 rounded-lg border border-sage-7 bg-sage-2 p-2 shadow-lg md:p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-sage-12">My Content Checklist</h1>
            <p className="text-xs text-sage-11">
              {missing.length === 0
                ? 'All official topics covered'
                : `${missing.length} ${missing.length === 1 ? 'topic still needs' : 'topics still need'} an answer. Save what you can; unanswered is not consent.`}
            </p>
            {saved && <output className="block text-xs text-plum-11">Checklist saved.</output>}
          </div>
          <Button type="submit" variant="primary" disabled={!isDirty || saving} loading={saving}>
            Save checklist
          </Button>
        </div>
        <div
          aria-label="Checklist icon legend"
          className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-sage-6 pt-1 text-xs text-sage-11"
        >
          <span className="flex items-center gap-1">
            <HeartFilledIcon aria-hidden="true" /> Enthusiastic
          </span>
          <span className="flex items-center gap-1">
            <EyeClosedIcon aria-hidden="true" /> Veil
          </span>
          <span className="flex items-center gap-1">
            <CrossCircledIcon aria-hidden="true" /> Hard line
          </span>
          <span className="flex items-center gap-1">
            <BellIcon aria-hidden="true" /> Heads-up
          </span>
          <span className="flex items-center gap-1">
            <Pencil2Icon aria-hidden="true" /> Note
          </span>
        </div>
        {error && (
          <Alert type="error" className="mt-2 p-2 text-sm">
            {error}{' '}
            {error.includes('Reload your checklist') && (
              <a className="underline" href={`/g/${guildId}/checklist`}>
                Reload your checklist
              </a>
            )}
          </Alert>
        )}
      </header>
      <details className="rounded-lg border border-sage-6 bg-sage-2 p-3 text-sm">
        <summary className="cursor-pointer font-medium text-sage-12">Checklist guidance</summary>
        <div className="mt-2">
          <MarkdownPreview content={guidance} />
        </div>
      </details>
      <p className="text-sm text-sage-11">
        Choose a boundary for each main topic. Subtopics may be left blank if you answered their
        parent. You can change answers at any time; this checklist does not replace speaking up or
        checking in.
      </p>
      <div className="rounded-lg border border-sage-6 bg-sage-2 px-2">
        {topics
          .filter((topic) => topic.parentTopicId === null)
          .map((parent) => (
            <section key={parent.id}>
              {topicFields(parent)}
              {topics
                .filter((topic) => topic.parentTopicId === parent.id)
                .map((child) => (
                  <div key={child.id} className="ml-3 border-l-2 border-sage-7 pl-2">
                    {topicFields(child)}
                  </div>
                ))}
            </section>
          ))}
        {topics.length === 0 && (
          <p className="py-2 text-sm">No official topics have been set up for this guild yet.</p>
        )}
      </div>
      <div className="rounded-lg border border-sage-6 bg-sage-2 px-2">
        <div className="flex items-center gap-2 py-1">
          <span className="min-w-0 flex-1 text-sm font-medium text-sage-12">
            Overall private note
          </span>
          <button
            type="button"
            disabled={saving}
            className={toggleStyle(Boolean(overallNote), 'bg-violet-9 text-white')}
            aria-label={`${overallNote ? 'Edit' : 'Add'} overall private note`}
            title={`${overallNote ? 'Edit' : 'Add'} overall private note`}
            aria-expanded={overallNoteOpen}
            aria-controls={overallNoteOpen ? 'overall-note-panel' : undefined}
            onClick={() => setOverallNoteOpen((open) => !open)}
          >
            <Pencil2Icon aria-hidden="true" className="size-4" />
          </button>
        </div>
        {overallNoteOpen && (
          <div id="overall-note-panel" className="pb-2">
            <label htmlFor="overall-consent-note" className="block text-sm text-sage-11">
              Overall private note (only consent coordinators in games you participate in can read
              this)
            </label>
            <textarea
              id="overall-consent-note"
              className="mt-1 w-full rounded-md border border-sage-7 bg-sage-1 p-2 text-sage-12"
              rows={5}
              maxLength={10000}
              disabled={saving}
              value={overallNote}
              onChange={(event) => {
                setOverallNote(event.target.value);
                setSaved(false);
              }}
            />
          </div>
        )}
      </div>
    </form>
  );
}
