'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { BellIcon, EyeClosedIcon, LockClosedIcon, LockOpen1Icon } from '@radix-ui/react-icons';
import {
  getGameConsentTopicDetails,
  getGameConsentOverallNotes,
} from '@/actions/consent-private-details';
import { getGameConsentStatus } from '@/actions/consent-game-status';
import { isFailure, type Result } from '@/actions/result';
import type { AggregatedTopic } from '@/lib/consent/aggregate';
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
}: {
  guildId: string;
  gameId: string;
  topics: AggregatedTopic[];
  canViewPrivateDetails: boolean;
}) {
  const [unlocked, setUnlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useCallback(() => setUnlocked(false), []);
  const onFailure = useCallback(() => {
    setUnlocked(false);
    setError(
      'Private details could not be loaded and have been hidden. Refresh before unlocking again.',
    );
  }, []);
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') lock();
    };
    window.addEventListener('pagehide', lock);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', lock);
      document.removeEventListener('visibilitychange', onVisibility);
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
                mode. Details lock when you leave this tab.
              </p>
            </div>
          ) : (
            <Paper>
              <h2 className="font-bold">Coordinator private details</h2>
              <p className="text-sm text-sage-11">
                Unlock to expand named player answers, private notes and contribution status. Stop
                screen-sharing before unlocking. No private data is loaded until you expand a pane.
              </p>
              <Button
                type="button"
                className="w-fit"
                onClick={() => {
                  setError(null);
                  setUnlocked(true);
                }}
              >
                <LockClosedIcon aria-hidden="true" className="mr-2" />
                Unlock private details
              </Button>
            </Paper>
          )}
        </div>
      )}
      {topics.length ? (
        <ConsentAggregate
          topics={topics}
          renderTopicDetails={
            privateVisible
              ? (topic) => (
                  <PrivatePanel
                    key={topic.id}
                    label={`Player details: ${topic.name}`}
                    onFailure={onFailure}
                    load={() => getGameConsentTopicDetails(guildId, gameId, topic.id)}
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
                )
              : undefined
          }
        />
      ) : (
        <Paper>Official consent topics are not configured yet.</Paper>
      )}
      {privateVisible && (
        <div className="print:hidden flex flex-col gap-4">
          <PrivatePanel
            label="Contribution status"
            onFailure={onFailure}
            load={() => getGameConsentStatus(guildId, gameId)}
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
          <PrivatePanel
            label="Overall private player notes"
            onFailure={onFailure}
            load={() => getGameConsentOverallNotes(guildId, gameId)}
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
        </div>
      )}
    </>
  );
}
