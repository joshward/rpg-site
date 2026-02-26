'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import * as v from 'valibot';
import { FormComboBox } from '@/components/FormComboBox';
import { ComboboxOption } from '@/components/Combobox';
import Paper from '@/components/Paper';
import Button from '@/components/Button';
import { saveGuildConfig } from '@/actions/guilds';
import { isFailure } from '@/actions/result';
import { useNotification } from '@/components/Notification';

interface GuildAdminFormProps {
  roles: ComboboxOption[];
  initialAllowedRoles: string[];
}

export default function GuildAdminForm({ roles, initialAllowedRoles }: GuildAdminFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();

  const form = useForm({
    defaultValues: {
      allowedRoles: roles.filter((role) => initialAllowedRoles.includes(role.id as string)),
    },
    onSubmit: async ({ value }) => {
      const result = await saveGuildConfig(
        guildId,
        value.allowedRoles.map((role) => role.id as string),
      );

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
          description: 'Guild settings saved successfully.',
        });
      }
    },
  });

  const allowedRolesValidator = v.pipe(
    v.array(v.object({ id: v.union([v.string(), v.number()]), label: v.string() })),
    v.minLength(1, 'Please select at least one role.'),
  );

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
          name="allowedRoles"
          validators={{
            onChange: ({ value }) => {
              const result = v.safeParse(allowedRolesValidator, value);
              return result.success ? undefined : result.issues[0].message;
            },
          }}
        >
          {(field) => (
            <FormComboBox
              label="Allowed Roles"
              description="Select the roles that are allowed to access Tavern Master features in this guild. Guild administrators always have access."
              items={roles}
              multiple
              placeholder="Select roles..."
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as ComboboxOption[])}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <div className="flex justify-end">
              <Button type="submit" disabled={!canSubmit} loading={isSubmitting}>
                Save Changes
              </Button>
            </div>
          )}
        />
      </form>
    </Paper>
  );
}
