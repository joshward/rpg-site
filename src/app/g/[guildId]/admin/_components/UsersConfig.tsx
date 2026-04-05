'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getAdminMemberPreferences, setAdminMemberPreference } from '@/actions/preferences';
import { startImpersonation } from '@/actions/auth-actions';
import { isFailure } from '@/actions/result';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircledIcon,
  CrossCircledIcon,
  PersonIcon,
} from '@radix-ui/react-icons';
import ComboBox, { ComboboxOption } from '@/components/Combobox';
import Button from '@/components/Button';
import { usePlausible } from 'next-plausible';
import { SESSIONS_PER_MONTH_OPTIONS } from '@/lib/preferences';
import { useNotification } from '@/components/Notification';
import { useRouter } from 'next/navigation';
import type { PlausibleEvents } from '@/lib/plausible-events';

interface MemberPreference {
  discordUserId: string;
  username: string;
  displayName: string;
  avatar: string | null | undefined;
  hasLoggedIn: boolean;
  lastLoginAt: string | null;
  sessionsPerMonth: number | null;
}

export default function UsersConfig() {
  const { guildId } = useParams<{ guildId: string }>();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [hasFetched, setHasFetched] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [members, setMembers] = React.useState<MemberPreference[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const notification = useNotification();
  const plausible = usePlausible<PlausibleEvents>();
  const router = useRouter();
  const [impersonatingId, setImpersonatingId] = React.useState<string | null>(null);

  const fetchMembers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAdminMemberPreferences(guildId);
    if (isFailure(result)) {
      setError(result.error);
    } else {
      setMembers(result.data);
      setHasFetched(true);
    }
    setLoading(false);
  }, [guildId]);

  React.useEffect(() => {
    if (isExpanded && !hasFetched && !loading) {
      fetchMembers();
    }
  }, [isExpanded, hasFetched, loading, fetchMembers]);

  const handleToggle = () => setIsExpanded((prev) => !prev);

  const handlePreferenceChange = async (discordUserId: string, option: ComboboxOption | null) => {
    if (!option) return;

    const result = await setAdminMemberPreference(guildId, discordUserId, option.id as number);

    if (isFailure(result)) {
      notification.add({
        type: 'error',
        title: 'Error',
        description: result.error,
      });
    } else {
      plausible('update_member_preference', {
        props: { guildId, discordUserId, sessionsPerMonth: option.id as number },
      });
      notification.add({
        type: 'success',
        title: 'Success',
        description: 'Member preference updated.',
      });
      // Update local state
      setMembers((prev) =>
        prev.map((m) =>
          m.discordUserId === discordUserId ? { ...m, sessionsPerMonth: option.id as number } : m,
        ),
      );
    }
  };

  const handleImpersonate = async (discordUserId: string) => {
    setImpersonatingId(discordUserId);
    const result = await startImpersonation(guildId, discordUserId);

    if (isFailure(result)) {
      notification.add({
        type: 'error',
        title: 'Error',
        description: result.error,
      });
      setImpersonatingId(null);
    } else {
      notification.add({
        type: 'success',
        title: 'Success',
        description: 'Impersonation started. Redirecting...',
      });
      router.push(`/g/${guildId}`);
    }
  };

  return (
    <Paper className="gap-0 p-0 overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full p-6 text-left hover:bg-sage-4/30 transition-colors focus:outline-none"
        onClick={handleToggle}
        aria-expanded={isExpanded}
        aria-controls="users-config-content"
      >
        <div className="flex flex-col">
          <h2 className="text-xl font-bold">Users Config</h2>
          <p className="text-sm text-sage-11">Manage session preferences for all guild members.</p>
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUpIcon className="size-5" />
          ) : (
            <ChevronDownIcon className="size-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div id="users-config-content" className="flex flex-col gap-4 border-t border-sage-6 p-6">
          {loading ? (
            <div className="h-60 flex items-center justify-center">
              <div className="loader"></div>
            </div>
          ) : error ? (
            <Alert type="error">{error}</Alert>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-sage-6 text-sm font-medium text-sage-11">
                    <th className="py-2 px-2">Member</th>
                    <th className="py-2 px-2 text-center">Tavern Master Login</th>
                    <th className="py-2 px-2">Sessions / Month</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sage-4">
                  {members.map((member) => (
                    <tr key={member.discordUserId} className="hover:bg-sage-3/50 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex flex-col">
                          <span className="font-medium text-sage-12 leading-none">
                            {member.displayName}
                          </span>
                          <span className="text-xs text-sage-10">@{member.username}</span>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-center">
                        {member.hasLoggedIn ? (
                          <div
                            className="flex flex-col items-center justify-center gap-0.5 text-emerald-10"
                            title={
                              member.lastLoginAt
                                ? `Last logged in: ${new Date(member.lastLoginAt).toLocaleString()}`
                                : 'Has logged in'
                            }
                          >
                            <div className="flex items-center gap-1.5">
                              <CheckCircledIcon className="size-5" />
                              <span className="text-xs font-medium">Logged In</span>
                            </div>
                            {member.lastLoginAt && (
                              <span className="text-[10px] text-sage-11 leading-none">
                                {new Date(member.lastLoginAt).toLocaleDateString(undefined, {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })}
                              </span>
                            )}
                          </div>
                        ) : (
                          <div
                            className="flex items-center justify-center gap-1.5 text-sage-8"
                            title="Never logged in"
                          >
                            <CrossCircledIcon className="size-5" />
                            <span className="text-xs font-medium text-sage-10">Never</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2 min-w-[200px]">
                        <ComboBox
                          size="sm"
                          items={SESSIONS_PER_MONTH_OPTIONS}
                          value={
                            SESSIONS_PER_MONTH_OPTIONS.find(
                              (opt) => opt.id === member.sessionsPerMonth,
                            ) || null
                          }
                          onValueChange={(val) =>
                            handlePreferenceChange(member.discordUserId, val as ComboboxOption)
                          }
                          placeholder="Unset"
                        />
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {member.hasLoggedIn && (
                            <Button
                              size="sm"
                              onClick={() => handleImpersonate(member.discordUserId)}
                              disabled={impersonatingId === member.discordUserId}
                              title="Impersonate User"
                              className="bg-violet-1 border-violet-7 hover:bg-violet-4 text-violet-11"
                            >
                              <PersonIcon className="mr-2 h-4 w-4" />
                              Impersonate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/g/${guildId}/availability?userId=${member.discordUserId}`,
                              )
                            }
                            title="Edit User Availability"
                          >
                            Edit Availability
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </Paper>
  );
}
