'use client';

import { useState, type FormEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { saveConsentAdminSettings } from '@/actions/consent-admin';
import { isFailure } from '@/actions/result';
import Alert from '@/components/Alert';
import Button from '@/components/Button';
import ConsentTopicEditor from './ConsentTopicEditor';
import type { OfficialConsentTopic } from '@/actions/consent-topics';
import { FormTextarea } from '@/components/FormTextarea';
import { useNotification } from '@/components/Notification';
import Paper from '@/components/Paper';
import { DEFAULT_CONSENT_GUIDANCE } from '@/lib/consent/guidance';

interface ConsentSettingsProps {
  initialEnabled: boolean;
  initialGuidance: string | null;
  initialTopics?: OfficialConsentTopic[];
  topicsError?: string;
}

export default function ConsentSettings({
  initialEnabled,
  initialGuidance,
  initialTopics = [],
  topicsError,
}: ConsentSettingsProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const router = useRouter();
  const notification = useNotification();
  const [enabled, setEnabled] = useState(initialEnabled);
  const [guidance, setGuidance] = useState(
    initialGuidance ?? (initialEnabled ? DEFAULT_CONSENT_GUIDANCE : ''),
  );
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const result = await saveConsentAdminSettings(guildId, enabled, guidance);
      notification.add(
        isFailure(result)
          ? { type: 'error', title: 'Could not save consent settings', description: result.error }
          : { type: 'success', title: 'Consent settings saved' },
      );
      if (!isFailure(result)) router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Paper>
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Consent checklists</h2>
            <p className="text-sm text-sage-11">
              Games will remain Off until individually configured. Topic changes save separately.
            </p>
          </div>
          <Button type="submit" variant="primary" disabled={saving} loading={saving}>
            Save enablement &amp; guidance
          </Button>
        </div>
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              const nextEnabled = event.target.checked;
              if (nextEnabled && !guidance.trim()) setGuidance(DEFAULT_CONSENT_GUIDANCE);
              setEnabled(nextEnabled);
            }}
          />
          Enable consent checklists for this guild
        </label>
        {enabled && (
          <>
            <div className="flex flex-col gap-2">
              <FormTextarea
                label="Checklist guidance (Markdown)"
                description="The default guidance is filled in automatically. You can edit or restore it."
                value={guidance}
                onChange={(event) => setGuidance(event.target.value)}
                textareaProps={{ className: 'h-36', maxLength: 10000 }}
              />
              {guidance !== DEFAULT_CONSENT_GUIDANCE && (
                <Button
                  type="button"
                  size="sm"
                  className="self-start"
                  onClick={() => setGuidance(DEFAULT_CONSENT_GUIDANCE)}
                >
                  Restore default guidance
                </Button>
              )}
            </div>
          </>
        )}
      </form>
      {enabled && initialEnabled && (
        <section className="mt-6 border-t border-sage-7 pt-6">
          {topicsError ? (
            <Alert type="error">{topicsError}</Alert>
          ) : (
            <ConsentTopicEditor initialTopics={initialTopics} />
          )}
        </section>
      )}
    </Paper>
  );
}
