import { getUsersGuilds } from '@/actions/guilds';
import { isFailure } from '@/actions/result';

export interface GuildRouteProps {
  params: Promise<{ guildId: string }>;
}

/**
 * Resolves the guild name for use in page metadata.
 * Returns undefined if the guild can't be found.
 */
export async function getGuildName(guildId: string): Promise<string | undefined> {
  const guildsResult = await getUsersGuilds();
  if (isFailure(guildsResult)) return undefined;
  return guildsResult.data?.find((g) => g.id === guildId)?.name;
}

export function getContactInfo(
  guildId: string,
  supportChannelId?: string,
  supportChannelName?: string,
  adminContactInfo?: string,
) {
  const adminText = adminContactInfo ? `talk to ${adminContactInfo}` : 'talk to your guild admin';
  const channelLink = supportChannelId
    ? `https://discord.com/channels/${guildId}/${supportChannelId}`
    : null;

  return { adminText, channelLink, channelName: supportChannelName };
}
