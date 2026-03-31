'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useForm } from '@tanstack/react-form';
import * as v from 'valibot';
import { FormInput } from '@/components/FormInput';
import { FormTextarea } from '@/components/FormTextarea';
import { FormComboBox } from '@/components/FormComboBox';
import { ComboboxOption } from '@/components/Combobox';
import Paper from '@/components/Paper';
import Button from '@/components/Button';
import MarkdownPreview from '@/components/MarkdownPreview';
import { createGame, updateGame, deleteGame } from '@/actions/games';
import { GameStatus } from '@/db/schema/games';
import { isFailure } from '@/actions/result';
import { useNotification } from '@/components/Notification';
import { TrashIcon, PersonIcon } from '@radix-ui/react-icons';
import ComboBox from '@/components/Combobox';
import ConfirmDialog from '@/components/ConfirmDialog';
import { twMerge } from 'tailwind-merge';

const GAME_STATUS_OPTIONS: ComboboxOption[] = [
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
  { id: 'paused', label: 'Paused' },
  { id: 'archived', label: 'Archived' },
];

interface EligibleMember {
  discordUserId: string;
  username: string;
  displayName: string;
  avatar: string | null | undefined;
}

interface GameMember {
  discordUserId: string;
  isRequired: boolean;
  displayName: string;
  avatar: string | null | undefined;
}

interface GameFormProps {
  initialData?: {
    id: string;
    name: string;
    description: string | null;
    status: GameStatus;
    sessionsPerMonth: number;
    members: {
      discordUserId: string;
      isRequired: boolean;
    }[];
  };
  eligibleMembers: EligibleMember[];
}

export default function GameForm({ initialData, eligibleMembers }: GameFormProps) {
  const { guildId } = useParams<{ guildId: string }>();
  const router = useRouter();
  const notification = useNotification();
  const [previewMode, setPreviewMode] = React.useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false);

  const handleDelete = async () => {
    if (!initialData) return;
    const result = await deleteGame(guildId, initialData.id);
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
        description: 'Game deleted successfully.',
      });
      router.push(`/g/${guildId}/games`);
    }
  };

  // Map initial members to include display info
  const initialMembers: GameMember[] = React.useMemo(() => {
    if (!initialData) return [];
    return initialData.members
      .map((m) => {
        const info = eligibleMembers.find((em) => em.discordUserId === m.discordUserId);
        if (!info) return null;
        return {
          ...m,
          displayName: info.displayName,
          avatar: info.avatar,
        };
      })
      .filter((m): m is GameMember => m !== null);
  }, [initialData, eligibleMembers]);

  const form = useForm({
    defaultValues: {
      name: initialData?.name ?? '',
      description: initialData?.description ?? '',
      status: GAME_STATUS_OPTIONS.find((opt) => opt.id === (initialData?.status ?? 'draft'))!,
      sessionsPerMonth: initialData?.sessionsPerMonth ?? 0,
      members: initialMembers,
    },
    onSubmit: async ({ value }) => {
      const payload = {
        name: value.name,
        description: value.description || null,
        status: value.status.id as GameStatus,
        sessionsPerMonth: Number(value.sessionsPerMonth),
        members: value.members.map((m) => ({
          discordUserId: m.discordUserId,
          isRequired: m.isRequired,
        })),
      };

      const result = initialData
        ? await updateGame(guildId, initialData.id, payload)
        : await createGame(guildId, payload);

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
          description: initialData ? 'Game updated successfully.' : 'Game created successfully.',
        });
        router.push(`/g/${guildId}/games`);
      }
    },
  });

  const memberOptions: ComboboxOption[] = eligibleMembers.map((m) => ({
    id: m.discordUserId,
    label: m.displayName,
  }));

  const handleAddMember = (option: ComboboxOption | null) => {
    if (!option) return;
    const discordUserId = option.id as string;

    // Check if already added
    const currentMembers = form.getFieldValue('members');
    if (currentMembers.some((m) => m.discordUserId === discordUserId)) {
      return;
    }

    const memberInfo = eligibleMembers.find((m) => m.discordUserId === discordUserId);
    if (!memberInfo) return;

    form.setFieldValue('members', [
      ...currentMembers,
      {
        discordUserId,
        isRequired: true,
        displayName: memberInfo.displayName,
        avatar: memberInfo.avatar,
      },
    ]);
  };

  const removeMember = (discordUserId: string) => {
    form.setFieldValue('members', (prev) => prev.filter((m) => m.discordUserId !== discordUserId));
  };

  const toggleRequired = (discordUserId: string) => {
    form.setFieldValue('members', (prev) =>
      prev.map((m) =>
        m.discordUserId === discordUserId ? { ...m, isRequired: !m.isRequired } : m,
      ),
    );
  };

  return (
    <Paper>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          form.handleSubmit();
        }}
        className="flex flex-col gap-8"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <form.Field
            name="name"
            validators={{
              onChange: v.pipe(v.string(), v.minLength(1, 'Name is required.')),
            }}
          >
            {(field) => (
              <FormInput
                label="Game Name"
                placeholder="e.g. The Shattered Isles"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                onBlur={field.handleBlur}
                error={field.state.meta.errors.join(', ')}
                invalid={field.state.meta.errors.length > 0}
              />
            )}
          </form.Field>

          <form.Field name="status">
            {(field) => (
              <FormComboBox
                label="Status"
                items={GAME_STATUS_OPTIONS}
                value={field.state.value}
                onValueChange={(val) => field.handleChange(val as ComboboxOption)}
              />
            )}
          </form.Field>

          <form.Field
            name="sessionsPerMonth"
            validators={{
              onChange: v.pipe(v.number('Must be a number'), v.minValue(0, 'Must be positive.')),
            }}
          >
            {(field) => (
              <FormInput
                label="Sessions Per Month"
                inputProps={{ type: 'number', min: 0 }}
                value={field.state.value}
                onChange={(e) => field.handleChange(Number(e.target.value))}
                onBlur={field.handleBlur}
                error={field.state.meta.errors.join(', ')}
                invalid={field.state.meta.errors.length > 0}
              />
            )}
          </form.Field>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-sage-11">Description (Markdown)</label>
            <button
              type="button"
              onClick={() => setPreviewMode(!previewMode)}
              className="text-xs font-medium text-plum-11 hover:text-plum-12 transition-colors"
            >
              {previewMode ? 'Edit Mode' : 'Preview Mode'}
            </button>
          </div>

          <form.Field name="description">
            {(field) => (
              <div className="min-h-[150px]">
                {previewMode ? (
                  <div className="p-4 rounded-xl border border-sage-6 bg-sage-2 min-h-[150px]">
                    {field.state.value ? (
                      <MarkdownPreview content={field.state.value} />
                    ) : (
                      <p className="text-sage-9 italic">No description provided.</p>
                    )}
                  </div>
                ) : (
                  <FormTextarea
                    placeholder="Describe your campaign..."
                    value={field.state.value}
                    onChange={(e) => field.handleChange(e.target.value)}
                    onBlur={field.handleBlur}
                  />
                )}
              </div>
            )}
          </form.Field>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-sage-11">Members</label>
            <p className="text-xs text-sage-10">Add members who are part of this game.</p>
          </div>

          <div className="flex flex-col gap-4">
            <ComboBox
              items={memberOptions}
              onValueChange={(val) => handleAddMember(val as ComboboxOption)}
              placeholder="Search members to add..."
              className="max-w-md"
            />

            <form.Field name="members">
              {(field) => (
                <div className="flex flex-col gap-2">
                  {field.state.value.length === 0 ? (
                    <p className="text-sm text-sage-9 italic p-4 border border-dashed border-sage-6 rounded-xl text-center">
                      No members added yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {field.state.value.map((m) => (
                        <div
                          key={m.discordUserId}
                          className="flex items-center justify-between p-3 rounded-xl border border-sage-6 bg-sage-2"
                        >
                          <div className="flex items-center gap-3">
                            <div className="size-8 rounded-full bg-sage-4 flex items-center justify-center overflow-hidden border border-sage-6">
                              {m.avatar ? (
                                <img
                                  src={`https://cdn.discordapp.com/avatars/${m.discordUserId}/${m.avatar}.png`}
                                  alt={m.displayName}
                                  className="size-full object-cover"
                                />
                              ) : (
                                <PersonIcon className="size-4 text-sage-9" />
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-sage-12 leading-none">
                                {m.displayName}
                              </span>
                              <button
                                type="button"
                                onClick={() => toggleRequired(m.discordUserId)}
                                className={twMerge(
                                  'text-[10px] font-bold uppercase tracking-wider mt-1 text-left hover:underline',
                                  m.isRequired ? 'text-amber-11' : 'text-sage-10',
                                )}
                              >
                                {m.isRequired ? 'Required' : 'Optional'}
                              </button>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMember(m.discordUserId)}
                            className="p-1.5 text-sage-9 hover:text-ruby-11 hover:bg-ruby-3 rounded-md transition-colors"
                            title="Remove member"
                          >
                            <TrashIcon className="size-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </form.Field>
          </div>
        </div>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting, state.isDirty]}
          children={([canSubmit, isSubmitting, isDirty]) => (
            <div className="flex flex-col sm:flex-row justify-between gap-4 border-t border-sage-6 pt-6">
              {initialData ? (
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => setIsDeleteDialogOpen(true)}
                  disabled={isSubmitting}
                >
                  <TrashIcon className="size-4 mr-2" />
                  Delete Game
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-4">
                <Button
                  type="button"
                  onClick={() => router.push(`/g/${guildId}/games`)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!canSubmit || (!isDirty && !!initialData)}
                  loading={isSubmitting}
                  variant="primary"
                >
                  {initialData ? 'Update Game' : 'Create Game'}
                </Button>
              </div>
            </div>
          )}
        />
      </form>

      <ConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        title="Delete Game"
        description={`Are you sure you want to delete "${initialData?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="default"
        onConfirm={handleDelete}
      />
    </Paper>
  );
}
