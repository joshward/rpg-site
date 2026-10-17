'use server';

import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { game, gameMember } from '@/db/schema/games';
import { ensureAdmin, getEffectiveUserContext } from './auth-helpers';
import { ActionError, asResult } from './action-helpers';
import { canAccessGameConsent, canAccessGuildConsent } from '@/lib/consent/feature-gate';

export const setConsentCoordinator = asResult(
  'setConsentCoordinator',
  async (guildId: string, gameId: string, discordUserId: string, assigned: boolean) => {
    const access = await ensureAdmin(guildId);
    const context = await getEffectiveUserContext(guildId);
    if (
      !context ||
      context.isImpersonating ||
      access.isImpersonating ||
      !canAccessGuildConsent(access.guildData?.consentEnabled === true) ||
      typeof assigned !== 'boolean' ||
      typeof gameId !== 'string' ||
      !gameId ||
      typeof discordUserId !== 'string' ||
      !discordUserId
    ) {
      throw new ActionError('Coordinator assignments are not available.');
    }
    const [selected] = await db
      .select({ mode: game.consentMode })
      .from(game)
      .where(and(eq(game.id, gameId), eq(game.guildId, guildId)));
    if (
      !selected ||
      !canAccessGameConsent(access.guildData?.consentEnabled === true, selected.mode)
    ) {
      throw new ActionError('Coordinator assignments are not available.');
    }
    const updated = await db
      .update(gameMember)
      .set({ isConsentCoordinator: assigned })
      .where(and(eq(gameMember.gameId, gameId), eq(gameMember.discordUserId, discordUserId)))
      .returning({ id: gameMember.id });
    if (!updated.length) throw new ActionError('Choose an existing game member.');
    revalidatePath(`/g/${guildId}`);
    revalidatePath(`/g/${guildId}/games/${gameId}`);
    revalidatePath(`/g/${guildId}/games/${gameId}/consent`);
  },
  'Could not save coordinator assignment.',
);
