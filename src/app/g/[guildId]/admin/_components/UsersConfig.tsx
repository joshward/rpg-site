'use client';

import * as React from 'react';
import { useParams } from 'next/navigation';
import Paper from '@/components/Paper';
import Alert from '@/components/Alert';
import { getAdminMemberPreferences, setAdminMemberPreference } from '@/actions/preferences';
import { isFailure } from '@/actions/result';
import {
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircledIcon,
  CrossCircledIcon,
} from '@radix-ui/react-icons';
import ComboBox, { ComboboxOption } from '@/components/Combobox';
import { SESSIONS_PER_MONTH_OPTIONS } from '@/lib/preferences';
import { useNotification } from '@/components/Notification';

export default function UsersConfig() {
  const { guildId } = useParams<{ guildId: string }>();
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [members, setMembers] = React.useState<any[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const notification = useNotification();

  const fetchMembers = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getAdminMemberPreferences(guildId);
    if (isFailure(result)) {
      setError(result.error);
    } else {
      setMembers(result.data);
    }
    setLoading(false);
  }, [guildId]);

  React.useEffect(() => {
    if (isExpanded && members.length === 0) {
      fetchMembers();
    }
  }, [isExpanded, members.length, fetchMembers]);

  const handleToggle = () => setIsExpanded(!isExpanded);

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

  return (
    <Paper className="gap-0 p-0 overflow-hidden">
      <button
        type="button"
        className="flex items-center justify-between w-full p-6 text-left hover:bg-sage-4/30 transition-colors focus:outline-none"
        onClick={handleToggle}
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
        <div className="flex flex-col gap-4 border-t border-sage-6 p-6">
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
                            className="flex items-center justify-center gap-1.5 text-emerald-10"
                            title="Has logged in"
                          >
                            <CheckCircledIcon className="size-5" />
                            <span className="text-xs font-medium">Logged In</span>
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
