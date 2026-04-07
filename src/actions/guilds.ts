'use server';

import { cache } from 'react';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/db/db';
import { fetchUserRole, fetchUsersGuilds } from '@/lib/authn';
import { ActionError, asResult } from '@/actions/action-helpers';
import { ensureAdmin, getEffectiveUserContext } from '@/actions/auth-helpers';
import { guild } from '@/db/schema/guild';
import { memberPreference } from '@/db/schema/member-preferences';
import { availabilitySubmission } from '@/db/schema/availability';
import {
  getGuildRoles,
  getGuildChannels,
  getCurrentUser,
  getGuildMember,
  getChannel,
  DiscordApiError,
} from '@/lib/discord/api';
import { TimeSpan } from 'timespan-ts';
import { revalidatePath } from 'next/cache';

const fetchUsersGuildsCached = cache(fetchUsersGuilds);
const getGuildRolesCached = cache((guildId: string) =>
  getGuildRoles({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) }),
);
const getGuildChannelsCached = cache((guildId: string) =>
  getGuildChannels({ guildId }, { cacheFor: TimeSpan.fromMinutes(30) }),
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

      // Backfill userId in availability_submissions if it's missing
      const availabilityNeedsBackfill = await db
        .select({ id: availabilitySubmission.id })
        .from(availabilitySubmission)
        .where(
          and(
            eq(availabilitySubmission.discordUserId, discordAccount.userId),
            isNull(availabilitySubmission.userId),
          ),
        )
        .limit(1);

      if (availabilityNeedsBackfill.length > 0) {
        await db
          .update(availabilitySubmission)
          .set({ userId: session.user.id })
          .where(
            and(
              eq(availabilitySubmission.discordUserId, discordAccount.userId),
              isNull(availabilitySubmission.userId),
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
      supportChannelId: guildData?.supportChannelId ?? undefined,
      supportChannelName: guildData?.supportChannelName ?? undefined,
      adminContactInfo: guildData?.adminContactInfo ?? undefined,
      adminNotificationChannelId: guildData?.adminNotificationChannelId ?? undefined,
      adminNotificationChannelName: guildData?.adminNotificationChannelName ?? undefined,
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

export const getGuildChannelsAction = asResult(
  'getGuildChannelsAction',
  async (guildId: string) => {
    await ensureAdmin(guildId);

    const channels = await getGuildChannelsCached(guildId);

    // Filter for text channels (0) and announcement channels (5)
    return channels
      .filter((channel) => channel.type === 0 || channel.type === 5)
      .map((channel) => ({
        id: channel.id,
        label: channel.name,
      }));
  },
  'Something went wrong fetching guild channels. Please try again later.',
);

export const checkBotPermissionsAction = asResult(
  'checkBotPermissionsAction',
  async (guildId: string, channelId: string) => {
    await ensureAdmin(guildId);

    // 1. Get bot's user ID
    const botUser = await getCurrentUser();

    // 2. Get bot's member in guild
    const botMember = await getGuildMember({ guildId, userId: botUser.id }).catch((err) => {
      if (err instanceof DiscordApiError && err.code === 404) {
        throw new ActionError('Bot is not a member of this guild.');
      }
      throw err;
    });

    // 3. Get guild roles to check base permissions
    const guildRoles = await getGuildRolesCached(guildId);

    // 4. Get channel info for overwrites
    const channel = await getChannel({ channelId }).catch((err) => {
      if (err instanceof DiscordApiError && (err.code === 403 || err.code === 404)) {
        return null;
      }
      throw err;
    });

    if (!channel) {
      return {
        hasPermissions: false,
        missing: ['View Channel'],
      };
    }

    if (channel.guild_id && channel.guild_id !== guildId) {
      throw new ActionError('Channel does not belong to this guild.');
    }

    // Calculation of permissions (simplified):
    const VIEW_CHANNEL = BigInt(0x400);
    const SEND_MESSAGES = BigInt(0x800);
    const ADMINISTRATOR = BigInt(0x8);

    // Start with @everyone role permissions
    const everyoneRole = guildRoles.find((r) => r.id === guildId);
    let permissions = everyoneRole ? BigInt(everyoneRole.permissions) : BigInt(0);

    // Add permissions from bot's roles
    for (const roleId of botMember.roles) {
      const role = guildRoles.find((r) => r.id === roleId);
      if (role) {
        permissions |= BigInt(role.permissions);
      }
    }

    // Administrator permission overrides everything
    if ((permissions & ADMINISTRATOR) === ADMINISTRATOR) {
      return { hasPermissions: true, missing: [] };
    }

    // Apply channel overwrites
    if (channel.permission_overwrites) {
      // @everyone overwrite
      const everyoneOverwrite = channel.permission_overwrites.find((o) => o.id === guildId);
      if (everyoneOverwrite) {
        permissions &= ~BigInt(everyoneOverwrite.deny);
        permissions |= BigInt(everyoneOverwrite.allow);
      }

      // Role overwrites
      let roleAllow = BigInt(0);
      let roleDeny = BigInt(0);
      for (const roleId of botMember.roles) {
        const overwrite = channel.permission_overwrites.find((o) => o.id === roleId);
        if (overwrite) {
          roleAllow |= BigInt(overwrite.allow);
          roleDeny |= BigInt(overwrite.deny);
        }
      }
      permissions &= ~roleDeny;
      permissions |= roleAllow;

      // Member overwrite
      const memberOverwrite = channel.permission_overwrites.find((o) => o.id === botUser.id);
      if (memberOverwrite) {
        permissions &= ~BigInt(memberOverwrite.deny);
        permissions |= BigInt(memberOverwrite.allow);
      }
    }

    const hasView = (permissions & VIEW_CHANNEL) === VIEW_CHANNEL;
    const hasSend = (permissions & SEND_MESSAGES) === SEND_MESSAGES;

    const missing: string[] = [];
    if (!hasView) missing.push('View Channel');
    if (!hasSend) missing.push('Send Messages');

    return {
      hasPermissions: hasView && hasSend,
      missing,
    };
  },
  'Something went wrong checking bot permissions. Please try again later.',
);

export const saveGuildConfig = asResult(
  'saveGuildConfig',
  async (
    guildId: string,
    allowedRoles: string[],
    supportChannelId?: string,
    supportChannelName?: string,
    adminContactInfo?: string,
    adminNotificationChannelId?: string,
    adminNotificationChannelName?: string,
  ) => {
    await ensureAdmin(guildId);

    await db
      .insert(guild)
      .values({
        id: guildId,
        allowedRoles,
        supportChannelId,
        supportChannelName,
        adminContactInfo,
        adminNotificationChannelId,
        adminNotificationChannelName,
      })
      .onConflictDoUpdate({
        target: guild.id,
        set: {
          allowedRoles,
          supportChannelId,
          supportChannelName,
          adminContactInfo,
          adminNotificationChannelId,
          adminNotificationChannelName,
        },
      });

    revalidatePath(`/g/${guildId}/admin`);
    revalidatePath(`/g/${guildId}`);
  },
  'Something went wrong saving guild settings. Please try again later.',
);
