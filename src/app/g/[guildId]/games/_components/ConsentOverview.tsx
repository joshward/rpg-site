'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  BellIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  EyeClosedIcon,
  LockClosedIcon,
  LockOpen1Icon,
} from '@radix-ui/react-icons';
import {
  getGameConsentTopicDetails,
  getGameConsentOverallNotes,
  getGameConsentNoteTopics,
} from '@/actions/consent-private-details';
import { getGameConsentStatus } from '@/actions/consent-game-status';
import { isFailure, type Result } from '@/actions/result';
import type { ConsentOverviewTopic } from '@/lib/consent/aggregate';
import { EMPTY_GROUP_NOTE, type ConsentGroupNote } from '@/lib/consent/group-notes';
import GroupNoteField from './GroupNoteField';
import ConsentAggregate, { ConsentAnswerBadge } from './ConsentAggregate';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import Paper from '@/components/Paper';

function PrivateContent<T>({
  load,
  render,
  onFailure,
}: {
  load: () => Promise<Result<T>>;
  render: (data: T) => ReactNode;
  onFailure: () => void;
}) {
  const [data, setData] = useState<T | null>(null);
  useEffect(() => {
    let active = true;
    load()
      .then((result) => {
        if (!active) return;
        if (isFailure(result)) onFailure();
        else setData(result.data);
      })
      .catch(() => {
        if (active) onFailure();
      });
    return () => {
      active = false;
    };
  }, [load, onFailure]);
  return data === null ? <output>Loading private details…</output> : <>{render(data)}</>;
}

function PrivatePanel<T>({
  label,
  load,
  render,
  onFailure,
}: {
  label: string;
  load: () => Promise<Result<T>>;
  render: (data: T) => ReactNode;
  onFailure: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="print:hidden rounded-lg border border-violet-7 bg-violet-2 p-3">
      <Button type="button" size="sm" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label}
      </Button>
      {open && (
        <div className="mt-3">
          <PrivateContent load={load} render={render} onFailure={onFailure} />
        </div>
      )}
    </div>
  );
}

export default function ConsentOverview({
  guildId,
  gameId,
  topics,
  canViewPrivateDetails,
  overallGroupNote = EMPTY_GROUP_NOTE,
}: {
  guildId: string;
  gameId: string;
  topics: ConsentOverviewTopic[];
  canViewPrivateDetails: boolean;
  overallGroupNote?: ConsentGroupNote;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noteTopicIds, setNoteTopicIds] = useState<string[]>([]);
  const [checkingNotes, setCheckingNotes] = useState(false);
  const [openTopics, setOpenTopics] = useState<string[]>([]);
  const [savedTopicNotes, setSavedTopicNotes] = useState<Record<string, ConsentGroupNote>>({});
  const [savedOverallNote, setSavedOverallNote] = useState<ConsentGroupNote | null>(null);
  const displayedTopics = useMemo(
    () =>
      topics.map((topic) => {
        const original = topic.groupNote ?? EMPTY_GROUP_NOTE;
        const saved = savedTopicNotes[topic.id];
        return {
          ...topic,
          groupNote: saved && saved.revision > original.revision ? saved : original,
        };
      }),
    [topics, savedTopicNotes],
  );
  const displayedOverallNote =
    savedOverallNote && savedOverallNote.revision > overallGroupNote.revision
      ? savedOverallNote
      : overallGroupNote;
  const topicLoaders = useMemo(
    () =>
      new Map(
        topics.map((topic) => [
          topic.id,
          () => getGameConsentTopicDetails(guildId, gameId, topic.id),
        ]),
      ),
    [topics, guildId, gameId],
  );
  const loadStatus = useCallback(() => getGameConsentStatus(guildId, gameId), [guildId, gameId]);
  const loadOverallNotes = useCallback(
    () => getGameConsentOverallNotes(guildId, gameId),
    [guildId, gameId],
  );
  const generation = useRef(0);
  const lock = useCallback(() => {
    generation.current++;
    setUnlocked(false);
    setNoteTopicIds([]);
    setCheckingNotes(false);
    setOpenTopics([]);
  }, []);
  const onFailure = useCallback(() => {
    lock();
    setError(
      'Private details could not be loaded and have been hidden. Refresh before unlocking again.',
    );
  }, [lock]);
  useEffect(() => {
    window.addEventListener('pagehide', lock);
    return () => {
      window.removeEventListener('pagehide', lock);
      lock();
    };
  }, [lock]);
  const privateVisible = canViewPrivateDetails && unlocked;
  return (
    <>
      {canViewPrivateDetails && (
        <div className={privateVisible ? 'print:hidden sticky top-2 z-40' : 'print:hidden'}>
          {error && <Alert type="error">{error}</Alert>}
          {privateVisible ? (
            <div
              className="rounded-xl border-2 border-ruby-8 bg-ruby-3 p-4 text-ruby-12 shadow-lg"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <strong className="inline-flex items-center gap-2">
                  <LockOpen1Icon aria-hidden="true" />
                  Private details visible
                </strong>
                <Button type="button" onClick={lock}>
                  <EyeClosedIcon aria-hidden="true" className="mr-2" />
                  Hide all private details
                </Button>
              </div>
              <p className="mt-2 text-sm">
                Expanded panes contain named answers and private notes. Do not screen-share this
                mode. Use Hide all private details before sharing your screen.
              </p>
              {checkingNotes && (
                <output className="mt-2 block text-sm">Checking topics for private notes…</output>
              )}
            </div>
          ) : (
            <Paper>
              <h2 className="font-bold">Coordinator private details</h2>
              <p className="text-sm text-sage-11">
                Unlock to expand named player answers, private notes and contribution status. Stop
                screen-sharing before unlocking. Unlocking checks which topics have notes; note text
                and named answers load only when you expand a pane.
              </p>
              <Button
                type="button"
                className="w-fit"
                onClick={() => {
                  setError(null);
                  setUnlocked(true);
                  setCheckingNotes(true);
                  const request = ++generation.current;
                  getGameConsentNoteTopics(guildId, gameId)
                    .then((result) => {
                      if (request !== generation.current) return;
                      if (isFailure(result)) onFailure();
                      else {
                        setNoteTopicIds(result.data);
                        setCheckingNotes(false);
                      }
                    })
                    .catch(() => {
                      if (request === generation.current) onFailure();
                    });
                }}
              >
                <LockClosedIcon aria-hidden="true" className="mr-2" />
                Unlock private details
              </Button>
            </Paper>
          )}
        </div>
      )}
      {privateVisible && (
        <PrivatePanel
          label="Contribution status"
          onFailure={onFailure}
          load={loadStatus}
          render={(status) =>
            !status.hasTopics ? (
              <p>Official consent topics are not configured yet.</p>
            ) : (
              <ul>
                {status.members.map((member) => (
                  <li key={member.discordUserId} className="flex justify-between gap-4 py-2">
                    <span>{member.displayName}</span>
                    <span>
                      {member.status === 'complete'
                        ? 'Complete'
                        : member.status === 'in-progress'
                          ? 'In progress'
                          : 'Not started'}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        />
      )}
      {(displayedOverallNote.note || privateVisible) && (
        <Paper>
          <h2 className="text-xl font-bold">Overall group notes</h2>
          <GroupNoteField
            key={`overall:${privateVisible}`}
            guildId={guildId}
            gameId={gameId}
            topicId={null}
            label="Overall game group note"
            value={displayedOverallNote}
            canEdit={privateVisible}
            onSaved={setSavedOverallNote}
          />
          {privateVisible && (
            <PrivatePanel
              label="Overall private player notes"
              onFailure={onFailure}
              load={loadOverallNotes}
              render={(members) => (
                <ul className="divide-y divide-violet-6">
                  {members.map((member) => (
                    <li key={member.discordUserId} className="py-2">
                      <strong>{member.displayName}</strong>
                      <p className="whitespace-pre-wrap text-sm">
                        {member.note ?? 'No overall note.'}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            />
          )}
        </Paper>
      )}
      {topics.length ? (
        <ConsentAggregate
          topics={displayedTopics}
          renderGroupNote={(topic) => (
            <GroupNoteField
              key={`${topic.id}:${privateVisible}`}
              guildId={guildId}
              gameId={gameId}
              topicId={topic.id}
              label={`Group note: ${topic.name}`}
              value={topic.groupNote ?? EMPTY_GROUP_NOTE}
              canEdit={privateVisible}
              onSaved={(note) =>
                setSavedTopicNotes((current) => ({ ...current, [topic.id]: note }))
              }
            />
          )}

          privateNoteTopicIds={privateVisible ? new Set(noteTopicIds) : undefined}
          renderTopicControl={
            privateVisible
              ? (topic) => (
                  <Button
                    type="button"
                    size="sm"
                    aria-label={`Full details: ${topic.name}`}
                    aria-expanded={openTopics.includes(topic.id)}
                    aria-controls={
                      openTopics.includes(topic.id) ? `private-topic-${topic.id}` : undefined
                    }
                    onClick={() =>
                      setOpenTopics((current) =>
                        current.includes(topic.id)
                          ? current.filter((id) => id !== topic.id)
                          : [...current, topic.id],
                      )
                    }
                  >
                    Full details
                    {openTopics.includes(topic.id) ? (
                      <ChevronUpIcon aria-hidden="true" className="ml-2" />
                    ) : (
                      <ChevronDownIcon aria-hidden="true" className="ml-2" />
                    )}
                  </Button>
                )
              : undefined
          }
          renderTopicDetails={
            privateVisible
              ? (topic) =>
                  openTopics.includes(topic.id) ? (
                    <div
                      id={`private-topic-${topic.id}`}
                      className="print:hidden rounded-lg border border-violet-7 bg-violet-2 p-3"
                    >
                      <PrivateContent
                        onFailure={onFailure}
                        load={topicLoaders.get(topic.id)!}
                        render={(members) => (
                          <ul className="divide-y divide-violet-6">
                            {members.map((member) => (
                              <li key={member.discordUserId} className="py-3">
                                <div className="flex flex-wrap items-center gap-2">
                                  <strong>{member.displayName}</strong>
                                  <ConsentAnswerBadge answer={member.answer} />
                                  {member.headsUp && (
                                    <span className="inline-flex items-center gap-1 rounded-md bg-plum-9 px-2 py-1 text-sm text-white">
                                      <BellIcon aria-hidden="true" />
                                      Heads-up
                                    </span>
                                  )}
                                  <span className="text-xs text-sage-11">
                                    {member.source === 'inherited'
                                      ? 'Inherited from parent topic'
                                      : member.source === 'explicit'
                                        ? 'Explicit answer'
                                        : 'Unanswered'}
                                  </span>
                                </div>
                                {member.note && (
                                  <p className="mt-2 whitespace-pre-wrap text-sm">
                                    <strong>Private topic note: </strong>
                                    {member.note}
                                  </p>
                                )}
                                {member.parentNote && (
                                  <p className="mt-2 whitespace-pre-wrap text-sm">
                                    <strong>Private parent-topic note: </strong>
                                    {member.parentNote}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      />
                    </div>
                  ) : null
              : undefined
          }
        />
      ) : (
        <Paper>Official consent topics are not configured yet.</Paper>
      )}
    </>
  );
}
