'use server';

import { cache } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { fetchUserRole, fetchUsersGuilds } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAdmin, getEffectiveUserContext } from '@/actions/auth-helpers';
import { guild } from '@/db/schema/guild';
import { memberPreference } from '@/db/schema/member-preferences';
import { getGuildRoles } from '@/lib/discord/api';
import { TimeSpan } from 'timespan-ts';
import { revalidatePath } from 'next/cache';

const fetchUsersGuildsCached = cache(fetchUsersGuilds);
const getGuildRolesCached = cache((guildId: string) =>
  getGuildRoles({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) }),
);

export const getUsersGuilds = asResult(
  'getUsersGuilds',
  async () => {
    const context = await getEffectiveUserContext();

    if (!context) {
      return null;
    }

    const { session, discordAccount } = context;

    if (discordAccount) {
      // Backfill userId in member_preferences if it's missing (requirement 71)
      // First, do a cheap existence check to avoid running an UPDATE on every call.
      const needsBackfill = await db
        .select({ id: memberPreference.id })
        .from(memberPreference)
        .where(
          and(
            eq(memberPreference.discordUserId, discordAccount.userId),
            isNull(memberPreference.userId),
          ),
        )
        .limit(1);

      if (needsBackfill.length > 0) {
        await db
          .update(memberPreference)
          .set({ userId: session.user.id })
          .where(
            and(
              eq(memberPreference.discordUserId, discordAccount.userId),
              isNull(memberPreference.userId),
            ),
          );
      }
    }

    return discordAccount
      ? await fetchUsersGuildsCached(discordAccount.userId, discordAccount.accessToken)
      : [];
  },
  'Something went wrong while fetching your guilds. Please try again later.',
);

export const getGuildInfo = asResult(
  'getGuildInfo',
  async (guildId: string) => {
    const context = await getEffectiveUserContext(guildId);

    if (!context) {
      throw new ActionError('Not logged in');
    }

    const { discordAccount } = context;
    if (!discordAccount) {
      throw new ActionError('Discord account not linked or session expired. Please sign in again.');
    }

    const userGuilds = await fetchUsersGuildsCached(
      discordAccount.userId,
      discordAccount.accessToken,
    );
    if (!userGuilds.some((g) => g.id === guildId)) {
      throw new ActionError('Guild not found');
    }

    const guildData = (await db.select().from(guild).where(eq(guild.id, guildId)))[0];

    const role = await fetchUserRole(discordAccount.userId, guildId, guildData?.allowedRoles ?? []);

    return {
      isConfigured: Boolean(guildData),
      role,
      allowedRoles: guildData?.allowedRoles ?? [],
      isImpersonating: context.isImpersonating,
    };
  },
  'Something went wrong fetching guild info. Please try again later.',
);

export const getGuildRolesAction = asResult(
  'getGuildRolesAction',
  async (guildId: string) => {
    await ensureAdmin(guildId);

    const roles = await getGuildRolesCached(guildId);

    return roles.map((role) => ({
      id: role.id,
      label: role.name,
    }));
  },
  'Something went wrong fetching guild roles. Please try again later.',
);

export const saveGuildConfig = asResult(
  'saveGuildConfig',
  async (guildId: string, allowedRoles: string[]) => {
    await ensureAdmin(guildId);

    await db
      .insert(guild)
      .values({
        id: guildId,
        allowedRoles,
      })
      .onConflictDoUpdate({
        target: guild.id,
        set: {
          allowedRoles,
        },
      });

    revalidatePath(`/g/${guildId}/admin`);
    revalidatePath(`/g/${guildId}`);
  },
  'Something went wrong saving guild settings. Please try again later.',
);
