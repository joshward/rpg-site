'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { twMerge } from 'tailwind-merge';
import Button from '@/components/Button';
import { DefaultTransitionStyles } from '@/styles/common';
import type {
  ScheduleNotificationDialogData,
  ScheduleNotificationDialogGame,
  ScheduleNotificationSendResponse,
  ScheduleNotificationSelection,
} from '@/actions/schedule-notifications';

function formatLastSentAt(value: Date | null) {
  if (!value) {
    return 'Not sent yet';
  }

  return new Date(value).toLocaleString();
}

interface ScheduleNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  sending: boolean;
  data: ScheduleNotificationDialogData | null;
  selectedByGameId: Record<string, boolean>;
  onToggleGame: (gameId: string, send: boolean) => void;
  onSend: (
    selections: ScheduleNotificationSelection[],
  ) => Promise<ScheduleNotificationSendResponse | null>;
}

interface SendSummaryProps {
  response: ScheduleNotificationSendResponse;
}

function SendSummary({ response }: SendSummaryProps) {
  return (
    <div className="rounded-lg border border-sage-5 bg-sage-3 p-3 text-xs">
      <h4 className="font-semibold text-sage-12 mb-2">Send results</h4>
      <ul className="flex flex-col gap-1.5">
        {response.results.map((result) => (
          <li key={result.gameId} className="text-sage-11">
            <span className="font-medium text-sage-12">{result.gameName}</span>: {result.status}
            {result.reason ? ` (${result.reason})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ScheduleNotificationDialog({
  open,
  onOpenChange,
  loading,
  sending,
  data,
  selectedByGameId,
  onToggleGame,
  onSend,
}: ScheduleNotificationDialogProps) {
  const [sendResponse, setSendResponse] = useState<ScheduleNotificationSendResponse | null>(null);

  useEffect(() => {
    if (!open) {
      setSendResponse(null);
    }
  }, [open]);

  const selectableCount = useMemo(() => {
    if (!data) {
      return 0;
    }

    return data.games.filter((game) => !game.disabled).length;
  }, [data]);

  const selectedCount = useMemo(() => {
    if (!data) {
      return 0;
    }

    return data.games.filter((game) => selectedByGameId[game.gameId]).length;
  }, [data, selectedByGameId]);

  const rows = data?.games ?? [];

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className={twMerge(DefaultTransitionStyles, 'fixed inset-0 bg-black-a8 z-50')}
        />
        <AlertDialog.Viewport className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <AlertDialog.Popup
            className={twMerge(
              'bg-sage-2 rounded-xl shadow-lg p-6 w-full max-w-3xl max-h-[85vh]',
              'flex flex-col gap-4 overflow-hidden',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <AlertDialog.Title className="text-lg font-bold text-sage-12">
                  Send schedule notifications
                </AlertDialog.Title>
                <AlertDialog.Description className="text-sm text-sage-11">
                  Choose which games should receive a schedule notification for this month.
                </AlertDialog.Description>
              </div>
              <div className="text-xs text-sage-10 mt-1">
                Selected {selectedCount} of {selectableCount}
              </div>
            </div>

            {loading ? (
              <div className="h-36 flex items-center justify-center text-sm text-sage-11">
                Loading schedule notification details...
              </div>
            ) : !data ? (
              <div className="h-36 flex items-center justify-center text-sm text-sage-11">
                Unable to load schedule notification details.
              </div>
            ) : (
              <div className="overflow-auto rounded-lg border border-sage-5">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-sage-3 border-b border-sage-5 text-left">
                      <th className="p-2 w-[80px]">Send</th>
                      <th className="p-2">Game</th>
                      <th className="p-2 w-[130px] text-right">Scheduled days</th>
                      <th className="p-2 w-[220px]">Last sent</th>
                      <th className="p-2">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((game) => (
                      <DialogRow
                        key={game.gameId}
                        game={game}
                        checked={selectedByGameId[game.gameId] ?? false}
                        onToggle={onToggleGame}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sendResponse && <SendSummary response={sendResponse} />}

            <div className="flex justify-end gap-2 mt-1">
              <AlertDialog.Close render={<Button size="sm">Close</Button>} />
              <Button
                size="sm"
                variant="primary"
                loading={sending}
                disabled={loading || !data}
                onClick={async () => {
                  if (!data) {
                    return;
                  }

                  const response = await onSend(
                    data.games.map((game) => ({
                      gameId: game.gameId,
                      send: !!selectedByGameId[game.gameId],
                    })),
                  );

                  if (response) {
                    setSendResponse(response);
                  }
                }}
              >
                Send Notifications
              </Button>
            </div>
          </AlertDialog.Popup>
        </AlertDialog.Viewport>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}

interface DialogRowProps {
  game: ScheduleNotificationDialogGame;
  checked: boolean;
  onToggle: (gameId: string, send: boolean) => void;
}

function DialogRow({ game, checked, onToggle }: DialogRowProps) {
  return (
    <tr className="border-b border-sage-4 last:border-b-0 hover:bg-sage-3/40">
      <td className="p-2 align-top">
        <input
          aria-label={`Send schedule notification for ${game.gameName}`}
          type="checkbox"
          className="mt-0.5"
          checked={checked}
          disabled={game.disabled}
          onChange={(event) => onToggle(game.gameId, event.target.checked)}
        />
      </td>
      <td className="p-2 align-top">
        <div className="font-medium text-sage-12">{game.gameName}</div>
        {game.scheduleNotificationChannelName && (
          <div className="text-xs text-sage-10">#{game.scheduleNotificationChannelName}</div>
        )}
      </td>
      <td className="p-2 align-top text-right tabular-nums">{game.scheduledDayCount}</td>
      <td className="p-2 align-top text-xs text-sage-11">{formatLastSentAt(game.lastSentAt)}</td>
      <td className="p-2 align-top">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {game.disabledReason && (
            <span className="rounded-full border border-ruby-6 bg-ruby-3 px-2 py-0.5 text-ruby-11">
              {game.disabledReason}
            </span>
          )}
          {game.stateReason && (
            <span className="rounded-full border border-sage-6 bg-sage-3 px-2 py-0.5 text-sage-11">
              {game.stateReason}
            </span>
          )}
          {checked && game.alreadySentThisMonth && (
            <span className="rounded-full border border-amber-6 bg-amber-3 px-2 py-0.5 text-amber-11">
              Already sent this month
            </span>
          )}
        </div>
      </td>
    </tr>
  );
}
