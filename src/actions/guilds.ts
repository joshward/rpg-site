import { headers } from 'next/headers';
import { eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { account } from '@/db/schema/auth';
import { auth } from '@/lib/auth';
import { fetchUsersGuilds } from '@/lib/authn';
import { asResult } from '@/actions/action-helpers';

async function getUsersDiscordAccount(
  userId: string,
): Promise<{ accessToken: string; userId: string } | undefined> {
  const accounts = await db.select().from(account).where(eq(account.userId, userId));
  const discordAccount = accounts.find((account) => account.providerId === 'discord');
  return discordAccount?.accessToken && discordAccount.accountId
    ? { accessToken: discordAccount.accessToken, userId: discordAccount.accountId }
    : undefined;
}

export const getUsersGuilds = asResult(
  'getUsersGuilds',
  async () => {
    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (!session) {
      return null;
    }

    const discordAccount = await getUsersDiscordAccount(session.user.id);
    const userGuilds = discordAccount
      ? await fetchUsersGuilds(discordAccount.userId, discordAccount.accessToken)
      : [];

    return userGuilds.map((role) => ({
      id: role.id,
      name: role.name,
      icon: role.icon,
    }));
  },
  'Something went wrong while fetching your guilds. Please try again later.',
);
