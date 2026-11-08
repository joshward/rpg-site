'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import * as v from 'valibot';
import { FormComboBox } from '@/components/FormComboBox';
import { FormInput } from '@/components/FormInput';
import { ComboboxOption } from '@/components/Combobox';
import Paper from '@/components/Paper';
import Button from '@/components/Button';
import MarkdownEditor from '@/components/MarkdownEditor';
import { saveGuildConfig, checkBotPermissionsAction } from '@/actions/guilds';
import { isFailure, isSuccess } from '@/actions/result';
import { useNotification } from '@/components/Notification';
import Switch from '@/components/Switch';
import { validThreshold } from '@/lib/inactivity';

interface GuildAdminFormProps {
  roles: ComboboxOption[];
  initialAllowedRoles: string[];
  channels: ComboboxOption[];
  initialSupportChannelId?: string;
  initialAdminContactInfo?: string;
  initialAdminNotificationChannelId?: string;
  initialGlobalNotificationChannelId?: string;
  initialOverviewText?: string;
  initialDefaultSchedulingDetails?: string;
  initialInactivityEnabled?: boolean;
  initialInactivityThreshold?: number;
}

export default function GuildAdminForm({
  roles,
  initialAllowedRoles,
  channels,
  initialSupportChannelId,
  initialAdminContactInfo,
  initialAdminNotificationChannelId,
  initialGlobalNotificationChannelId,
  initialOverviewText,
  initialDefaultSchedulingDetails,
  initialInactivityEnabled = false,
  initialInactivityThreshold = 3,
}: GuildAdminFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const notification = useNotification();
  const router = useRouter();

  const form = useForm({
    defaultValues: {
      allowedRoles: roles.filter((role) => initialAllowedRoles.includes(role.id as string)),
      supportChannel: channels.find((c) => c.id === initialSupportChannelId) ?? null,
      adminContactInfo: initialAdminContactInfo ?? '',
      adminNotificationChannel:
        channels.find((c) => c.id === initialAdminNotificationChannelId) ?? null,
      globalNotificationChannel:
        channels.find((c) => c.id === initialGlobalNotificationChannelId) ?? null,
      overviewText: initialOverviewText ?? '',
      defaultSchedulingDetails: initialDefaultSchedulingDetails ?? '',
      inactivityEnabled: initialInactivityEnabled,
      inactivityThreshold: initialInactivityThreshold,
    },
    onSubmit: async ({ value }) => {
      const result = await saveGuildConfig(
        guildId,
        value.allowedRoles.map((role) => role.id as string),
        value.supportChannel?.id as string | undefined,
        value.supportChannel?.label as string | undefined,
        value.adminContactInfo,
        value.adminNotificationChannel?.id as string | undefined,
        value.adminNotificationChannel?.label as string | undefined,
        value.globalNotificationChannel?.id as string | undefined,
        value.globalNotificationChannel?.label as string | undefined,
        value.overviewText,
        value.defaultSchedulingDetails,
        { enabled: value.inactivityEnabled, threshold: value.inactivityThreshold },
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
        router.refresh();
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

        <form.Field name="supportChannel">
          {(field) => (
            <FormComboBox
              label="Support Channel"
              description="Select a channel where users can reach out for help. A link to this channel will be included in error messages."
              items={channels}
              placeholder="Select a channel..."
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as ComboboxOption | null)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Field
          name="adminNotificationChannel"
          validators={{
            onChangeAsync: async ({ value }) => {
              if (!value) return undefined;
              const result = await checkBotPermissionsAction(guildId, value.id as string);
              if (isFailure(result)) return result.error;
              if (isSuccess(result) && !result.data.hasPermissions) {
                return `Bot is missing permissions in this channel: ${result.data.missing.join(', ')}`;
              }
              return undefined;
            },
            onChangeAsyncDebounceMs: 500,
          }}
        >
          {(field) => (
            <FormComboBox
              label="Admin Notification Channel"
              description="Select a channel where the bot will send notifications to admins (e.g. availability updates)."
              items={channels}
              placeholder="Select a channel..."
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as ComboboxOption | null)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Field
          name="globalNotificationChannel"
          validators={{
            onChangeAsync: async ({ value }) => {
              if (!value) return undefined;
              const result = await checkBotPermissionsAction(guildId, value.id as string);
              if (isFailure(result)) return result.error;
              if (isSuccess(result) && !result.data.hasPermissions) {
                return `Bot is missing permissions in this channel: ${result.data.missing.join(', ')}`;
              }
              return undefined;
            },
            onChangeAsyncDebounceMs: 500,
          }}
        >
          {(field) => (
            <FormComboBox
              label="Global Notification Channel"
              description="Select a channel where the bot will send global notifications to all players (e.g. availability reminders)."
              items={channels}
              placeholder="Select a channel..."
              value={field.state.value}
              onValueChange={(val) => field.handleChange(val as ComboboxOption | null)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Field name="adminContactInfo">
          {(field) => (
            <FormInput
              label="Admin Contact Info"
              description="Provide the name or handle of the admin(s) users should contact (e.g., 'Jane Doe (@janedoe)')."
              placeholder="e.g. @janedoe"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Field name="defaultSchedulingDetails">
          {(field) => (
            <FormInput
              label="Default Scheduling Details"
              description="Standard scheduling info for this guild (e.g. '6:00pm to 9:30pm @ Josh's')."
              placeholder="e.g. 6:00pm to 9:30pm"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              error={field.state.meta.errors.join(', ')}
              invalid={field.state.meta.errors.length > 0}
            />
          )}
        </form.Field>

        <form.Field name="inactivityEnabled">
          {(field) => (
            <Switch
              label="Enable inactive player management"
              checked={field.state.value}
              onCheckedChange={(enabled) => {
                field.handleChange(enabled);
                if (!enabled && !validThreshold(form.getFieldValue('inactivityThreshold'))) {
                  form.setFieldValue('inactivityThreshold', initialInactivityThreshold);
                }
              }}
            />
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.inactivityEnabled}>
          {(enabled) => (
            <form.Field
              name="inactivityThreshold"
              validators={{
                onChange: ({ value }) =>
                  validThreshold(value) ? undefined : 'Choose 2–12 unanswered submission cycles.',
              }}
            >
              {(field) => (
                <FormInput
                  label="Unanswered submission cycles"
                  inputProps={{ type: 'number', min: 2, max: 12, step: 1 }}
                  disabled={!enabled}
                  value={field.state.value}
                  onChange={(event) => field.handleChange(Number(event.target.value))}
                  error={field.state.meta.errors.join(', ')}
                  invalid={field.state.meta.errors.length > 0}
                />
              )}
            </form.Field>
          )}
        </form.Subscribe>

        <form.Field name="overviewText">
          {(field) => (
            <MarkdownEditor
              label="Overview Text"
              description="Custom markdown text to display on the guild overview page. Replaces the default welcome message."
              placeholder="Welcome to our guild! Here is some information..."
              value={field.state.value}
              onValueChange={field.handleChange}
              onBlur={field.handleBlur}
              error={field.state.meta.errors.join(', ')}
              rows={5}
              allowImages
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
