'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import { FormComboBox } from '@/components/FormComboBox';
import { ComboboxOption } from '@/components/Combobox';
import Paper from '@/components/Paper';
import Button from '@/components/Button';
import { setMyPreference } from '@/actions/preferences';
import { NO_LIMIT } from '@/lib/preferences';
import { isFailure } from '@/actions/result';
import { useNotification } from '@/components/Notification';

const options: ComboboxOption[] = [
  { id: 0, label: '0 (Not participating)' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ id: n, label: n.toString() })),
  { id: NO_LIMIT, label: 'No Limit' },
];

interface PreferencesFormProps {
  initialSessionsPerMonth: number | null;
}

export default function PreferencesForm({ initialSessionsPerMonth }: PreferencesFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();

  const initialOption = options.find((opt) => opt.id === initialSessionsPerMonth) || null;

  const form = useForm({
    defaultValues: {
      sessionsPerMonth: initialOption,
    },
    onSubmit: async ({ value }) => {
      if (!value.sessionsPerMonth) return;

      const result = await setMyPreference(guildId, value.sessionsPerMonth.id as number);

      if (isFailure(result)) {
        notification.add({
          type: 'error',
          title: 'Error',
          description: result.error,
        });
      } else {
        notification.add({
          type: 'success',
          title: 'Success',
          description: 'Preferences saved successfully.',
        });
      }
    },
  });

  return (
    <Paper>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-6"
      >
        <form.Field
          name="sessionsPerMonth"
          validators={{
            onChange: ({ value }) => {
              if (!value) return 'Please select your session preference.';
              return undefined;
            },
          }}
        >
          {(field) => (
            <FormComboBox
              label="Sessions Per Month"
              description="Your ideal number of sessions per month in this guild. This helps admins when scheduling sessions."
              items={options}
              multiple={false}
              placeholder="Select preference..."
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
          children={([canSubmit, isSubmitting, isDirty]) => (
            <div className="flex justify-end">
              <Button type="submit" disabled={!canSubmit || !isDirty} loading={isSubmitting}>
                Save Preferences
              </Button>
            </div>
          )}
        />
      </form>
    </Paper>
  );
}
