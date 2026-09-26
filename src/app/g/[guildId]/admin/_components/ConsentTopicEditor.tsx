'use client';

import { useState, type FormEvent } from 'react';
import { useParams } from 'next/navigation';
import {
  addOfficialConsentTopic,
  renameOfficialConsentTopic,
  deleteOfficialConsentTopic,
  type OfficialConsentTopic,
} from '@/actions/consent-topics';
import { isFailure } from '@/actions/result';
import Button from '@/components/Button';
import ConfirmDialog from '@/components/ConfirmDialog';
import { FormInput } from '@/components/FormInput';
import { useNotification } from '@/components/Notification';

export default function ConsentTopicEditor({
  initialTopics,
}: {
  initialTopics: OfficialConsentTopic[];
}) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();
  const [topics, setTopics] = useState(initialTopics);
  const [name, setName] = useState('');
  const [adding, setAdding] = useState<{ parentId: string | null } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [answerChoice, setAnswerChoice] = useState<'' | 'keep' | 'clear'>('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const parents = topics.filter((topic) => topic.parentTopicId === null);

  function hasSiblingDuplicate(parentId: string | null, candidate: string, excludeId?: string) {
    const normalized = candidate.trim().toLowerCase();
    return Boolean(
      normalized &&
      topics.some(
        (topic) =>
          topic.parentTopicId === parentId &&
          topic.id !== excludeId &&
          topic.name.trim().toLowerCase() === normalized,
      ),
    );
  }

  async function addTopic(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adding || !name.trim() || hasSiblingDuplicate(adding.parentId, name)) return;
    setBusy(true);
    try {
      const result = await addOfficialConsentTopic(guildId, name, adding.parentId);
      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Could not add topic',
          description: result.error,
        });
        return;
      }
      setTopics((current) => [...current, result.data]);
      setName('');
      setAdding(null);
      notification.add({ type: 'success', title: 'Topic added' });
    } finally {
      setBusy(false);
    }
  }

  async function renameTopic(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const topic = topics.find((item) => item.id === id);
    if (!answerChoice || !topic || hasSiblingDuplicate(topic.parentTopicId, renameValue, id))
      return;
    setBusy(true);
    try {
      const result = await renameOfficialConsentTopic(guildId, id, renameValue, answerChoice);
      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Could not rename topic',
          description: result.error,
        });
        return;
      }
      setTopics((current) =>
        current.map((topic) => (topic.id === id ? { ...topic, name: renameValue.trim() } : topic)),
      );
      setEditing(null);
      notification.add({ type: 'success', title: 'Topic renamed' });
    } finally {
      setBusy(false);
    }
  }

  async function deleteTopic(id: string) {
    setBusy(true);
    try {
      const result = await deleteOfficialConsentTopic(guildId, id);
      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Could not remove topic',
          description: result.error,
        });
        return;
      }
      setTopics((current) =>
        current.filter((topic) => topic.id !== id && topic.parentTopicId !== id),
      );
      if (adding?.parentId === id) setAdding(null);
      notification.add({ type: 'success', title: 'Topic removed' });
    } finally {
      setBusy(false);
    }
  }

  function startEditing(topic: OfficialConsentTopic) {
    setAdding(null);
    setEditing(topic.id);
    setRenameValue(topic.name);
    setAnswerChoice('');
  }

  function addForm(parent: OfficialConsentTopic | null) {
    const duplicate = hasSiblingDuplicate(parent?.id ?? null, name);
    return (
      <form onSubmit={addTopic} className="flex flex-wrap items-end gap-2 py-2">
        <FormInput
          label={parent ? `New subtopic under ${parent.name}` : 'New main topic'}
          value={name}
          onChange={(event) => setName(event.target.value)}
          inputProps={{ maxLength: 120, required: true, autoFocus: true }}
        />
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={busy || !name.trim() || duplicate}
        >
          Save
        </Button>
        {duplicate && (
          <p role="alert" className="text-sm text-ruby-11">
            This topic already exists here.
          </p>
        )}
        <Button type="button" size="sm" onClick={() => setAdding(null)}>
          Cancel
        </Button>
      </form>
    );
  }

  function startAdding(parentId: string | null) {
    setEditing(null);
    setName('');
    setAdding({ parentId });
  }

  function topicRow(topic: OfficialConsentTopic) {
    return (
      <li key={topic.id} className="border-b border-sage-6 py-2 last:border-0">
        {editing === topic.id ? (
          <form onSubmit={(event) => renameTopic(event, topic.id)} className="flex flex-col gap-2">
            <label htmlFor={`rename-${topic.id}`} className="text-sm font-medium">
              Rename {topic.parentTopicId ? 'subtopic' : 'topic'}
            </label>
            <input
              id={`rename-${topic.id}`}
              className="rounded border border-sage-7 bg-sage-2 p-2"
              value={renameValue}
              maxLength={120}
              onChange={(event) => setRenameValue(event.target.value)}
              required
            />
            <fieldset className="text-sm">
              <legend>What should happen to existing answers?</legend>
              <label className="mr-4 inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`answers-${topic.id}`}
                  checked={answerChoice === 'keep'}
                  onChange={() => setAnswerChoice('keep')}
                />
                Keep answers
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  name={`answers-${topic.id}`}
                  checked={answerChoice === 'clear'}
                  onChange={() => setAnswerChoice('clear')}
                />
                Clear answers
              </label>
            </fieldset>
            {hasSiblingDuplicate(topic.parentTopicId, renameValue, topic.id) && (
              <p role="alert" className="text-sm text-ruby-11">
                This topic already exists here.
              </p>
            )}
            <div className="flex gap-2">
              <Button
                type="submit"
                size="sm"
                disabled={
                  busy ||
                  !answerChoice ||
                  hasSiblingDuplicate(topic.parentTopicId, renameValue, topic.id)
                }
              >
                Save rename
              </Button>
              <Button type="button" size="sm" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between gap-2">
            <span>{topic.name}</span>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={() => startEditing(topic)}>
                Rename
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                disabled={busy}
                onClick={() => {
                  setAdding(null);
                  setEditing(null);
                  setDeleting(topic.id);
                }}
              >
                Remove
              </Button>
            </div>
          </div>
        )}
      </li>
    );
  }

  const deletingTopic = topics.find((topic) => topic.id === deleting);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-lg font-semibold">Official topics</h3>
          <p className="text-sm text-sage-11">
            Add main topics and one level of subtopics. These will appear on every guild
            member&apos;s checklist once the player form is available.
          </p>
        </div>
        {parents.length === 0 && <p>No topics yet.</p>}
        <ul className="flex flex-col gap-3">
          {parents.map((parent) => (
            <li key={parent.id}>
              <ul>{topicRow(parent)}</ul>
              {topics.some((topic) => topic.parentTopicId === parent.id) && (
                <ul className="ml-6 border-l border-sage-7 pl-3">
                  {topics.filter((topic) => topic.parentTopicId === parent.id).map(topicRow)}
                </ul>
              )}
              <div className="ml-6">
                {adding?.parentId === parent.id ? (
                  addForm(parent)
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    disabled={busy}
                    onClick={() => startAdding(parent.id)}
                  >
                    + Add subtopic
                  </Button>
                )}
              </div>
            </li>
          ))}
          <li className="border-t border-sage-7 pt-2">
            {adding?.parentId === null ? (
              addForm(null)
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => startAdding(null)}>
                + Add topic
              </Button>
            )}
          </li>
        </ul>
      </div>
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={`Remove ${deletingTopic?.name ?? 'topic'}?`}
        description={
          deletingTopic?.parentTopicId
            ? 'This subtopic will be deleted.'
            : 'This topic and all its subtopics will be deleted.'
        }
        confirmLabel="Remove topic"
        confirmVariant="danger"
        onConfirm={() => {
          if (deleting) void deleteTopic(deleting);
        }}
      />
    </>
  );
}
