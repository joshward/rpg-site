import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkBotPermissionsAction } from '@/actions/guilds';
import { validateScheduleNotificationChannelPermissions } from '../GameForm';

vi.mock('@/actions/guilds', () => ({
  checkBotPermissionsAction: vi.fn(),
}));

describe('validateScheduleNotificationChannelPermissions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns undefined without checking permissions when no channel is selected', async () => {
    const result = await validateScheduleNotificationChannelPermissions('guild-1', null);

    expect(result).toBeUndefined();
    expect(checkBotPermissionsAction).not.toHaveBeenCalled();
  });

  it('returns failure error when permission check action fails', async () => {
    vi.mocked(checkBotPermissionsAction).mockResolvedValueOnce({
      type: 'failure',
      error: 'Something went wrong checking bot permissions.',
    });

    const result = await validateScheduleNotificationChannelPermissions('guild-1', {
      id: 'channel-1',
      label: 'General',
    });

    expect(result).toBe('Something went wrong checking bot permissions.');
    expect(checkBotPermissionsAction).toHaveBeenCalledWith('guild-1', 'channel-1');
  });

  it('returns a missing permissions message when bot lacks required channel permissions', async () => {
    vi.mocked(checkBotPermissionsAction).mockResolvedValueOnce({
      type: 'success',
      data: {
        hasPermissions: false,
        missing: ['View Channel', 'Send Messages'],
      },
    });

    const result = await validateScheduleNotificationChannelPermissions('guild-1', {
      id: 'channel-1',
      label: 'General',
    });

    expect(result).toBe('Bot is missing permissions in this channel: View Channel, Send Messages');
  });

  it('returns undefined when bot has required channel permissions', async () => {
    vi.mocked(checkBotPermissionsAction).mockResolvedValueOnce({
      type: 'success',
      data: {
        hasPermissions: true,
        missing: [],
      },
    });

    const result = await validateScheduleNotificationChannelPermissions('guild-1', {
      id: 'channel-1',
      label: 'General',
    });

    expect(result).toBeUndefined();
  });
});
