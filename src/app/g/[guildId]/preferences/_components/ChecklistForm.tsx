'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
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
// Amber 9 stays bright in both themes; amber 12 becomes pale in dark mode.
const amberActive = 'bg-amber-9 text-amber-12 dark:text-amber-1';
const jadeActive = 'bg-jade-9 text-jade-12 dark:text-jade-1';
const plumActive = 'bg-plum-9 text-white';
const choices = [
  {
    value: 'enthusiastic',
    label: 'All good',
    legend: 'All good',
    description: 'I am comfortable if this content ends up on-screen in the game.',
    icon: HeartFilledIcon,
    active: jadeActive,
  },
  {
    value: 'veil',
    label: 'Veil (off-screen)',
    legend: 'Veil',
    description: 'It can happen, but leave it off-screen or without detail.',
    icon: EyeClosedIcon,
    active: amberActive,
  },
  {
    value: 'line',
    label: 'Hard line (do not include)',
    legend: 'Hard line',
    description:
      'Do not depict or focus on this content in the game. It may exist in the world, but it won’t be part of play.',
    icon: CrossCircledIcon,
    active: 'bg-ruby-9 text-white',
  },
] as const;

const legend = [
  ...choices.map(({ legend: label, description, icon, active }) => ({
    label,
    description,
    icon,
    active,
  })),
  {
    label: 'Heads-up',
    description: "Warn me before this comes up or if it's a likely topic of this game.",
    icon: BellIcon,
    active: plumActive,
  },
  {
    label: 'Note',
    description: 'Add private context for consent coordinators in my games.',
    icon: Pencil2Icon,
    active: 'bg-violet-9 text-white',
  },
];

const toggleBase =
  'flex size-9 shrink-0 items-center justify-center rounded-md border border-sage-7 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-8 disabled:cursor-not-allowed disabled:opacity-40';
function toggleStyle(active: boolean, activeStyle: string) {
  return `${toggleBase} ${active ? activeStyle : 'bg-sage-2 text-sage-11 hover:bg-sage-4'}`;
}

function ChecklistLegend({ compact }: { compact: boolean }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [clicked, setClicked] = useState<string | null>(null);
  const activeLabel = hovered ?? clicked;
  const activeItem = legend.find((item) => item.label === activeLabel);

  return (
    <div
      aria-label="Checklist icon legend"
      className={`relative mt-2 border-t border-sage-6 pt-2 text-xs text-sage-11 ${
        compact ? 'flex flex-wrap items-center justify-end gap-x-3 gap-y-1' : 'flex flex-wrap gap-3'
      }`}
    >
      {legend.map(({ label, description, icon: Icon, active }) =>
        compact ? (
          <button
            key={label}
            type="button"
            className="flex items-center gap-1.5 rounded-md text-sage-12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-8"
            aria-label={`${label}: ${description}`}
            aria-expanded={activeLabel === label}
            aria-controls={activeLabel === label ? 'checklist-legend-description' : undefined}
            onMouseEnter={() => setHovered(label)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => setClicked((current) => (current === label ? null : label))}
            onBlur={() => setClicked(null)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setHovered(null);
                setClicked(null);
              }
            }}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-md ${active}`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span className="font-semibold leading-none">{label}</span>
          </button>
        ) : (
          <div key={label} className="flex min-w-40 flex-1 items-start gap-2">
            <span
              className={`flex size-9 shrink-0 items-center justify-center rounded-md ${active}`}
            >
              <Icon aria-hidden="true" className="size-4" />
            </span>
            <span>
              <strong className="font-semibold text-sage-12">{label}</strong>
              <span className="block">{description}</span>
            </span>
          </div>
        ),
      )}
      {compact && activeItem && (
        <div
          id="checklist-legend-description"
          role="tooltip"
          className="absolute top-full right-0 z-50 mt-1 w-64 max-w-full rounded-md border border-sage-7 bg-sage-2 p-2 text-sage-12 shadow-lg"
        >
          <strong>{activeItem.label}:</strong> {activeItem.description}
        </div>
      )}
    </div>
  );
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
  const [guideOpen, setGuideOpen] = useState(true);
  const [isSticky, setIsSticky] = useState(false);
  const stickySentinel = useRef<HTMLDivElement>(null);
  const stickyHeader = useRef<HTMLElement>(null);
  const { topics, guidance } = initialChecklist;

  useEffect(() => {
    const sentinel = stickySentinel.current;
    const header = stickyHeader.current;
    if (!sentinel || !header) return;

    const onScroll = () => {
      const distancePastStart = -sentinel.getBoundingClientRect().top;
      setIsSticky((wasSticky) => {
        // Wait until the expanded header has passed the viewport before shrinking.
        // Keep it shrunk until we return to the start; this gap prevents layout
        // changes and browser scroll anchoring from rapidly flipping modes.
        if (wasSticky) return distancePastStart > 0;
        return distancePastStart > Math.max(160, header.offsetHeight + 24);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
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
      <fieldset className="min-w-0 border-b border-sage-7/60">
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
              className={toggleStyle(draft.headsUp, plumActive)}
              aria-label={`Heads-up for ${topic.name}`}
              title={
                canRequestHeadsUp
                  ? `Heads-up for ${topic.name}`
                  : 'Choose All good or Veil to request a heads-up'
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
      <div ref={stickySentinel} aria-hidden="true" className="h-px" />
      <header
        ref={stickyHeader}
        className="sticky top-0 z-30 rounded-lg border border-sage-7 bg-sage-2 p-2 shadow-lg md:p-3"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-sage-12">My Content Checklist</h2>
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
        <ChecklistLegend key={isSticky ? 'compact' : 'expanded'} compact={isSticky} />
        {error && (
          <Alert type="error" className="mt-2 p-2 text-sm">
            {error}{' '}
            {error.includes('Reload your checklist') && (
              <a className="underline" href={`/g/${guildId}/preferences#content-checklist`}>
                Reload your checklist
              </a>
            )}
          </Alert>
        )}
      </header>
      <details
        open={guideOpen}
        onToggle={(event) => setGuideOpen(event.currentTarget.open)}
        className="rounded-lg border border-sage-6 bg-sage-2 p-3 text-sm"
      >
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
