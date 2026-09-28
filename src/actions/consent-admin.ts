'use server';

import { and, eq, isNull } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { guild } from '@/db/schema/guild';
import { consentTopic } from '@/db/schema/consent-topics';
import { ensureAdmin } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { isConsentFeatureEnabled } from '@/lib/consent/feature-gate';
import { makeStarterConsentTopicRows } from '@/lib/consent/starter-topics';

function requireConsentAdminFeature() {
  if (!isConsentFeatureEnabled()) {
    throw new ActionError('Consent checklists are not available.');
  }
}

// An admin must be able to prepare these settings while the guild is still Off.
export const getConsentAdminSettings = asResult(
  'getConsentAdminSettings',
  async (guildId: string) => {
    requireConsentAdminFeature();
    await ensureAdmin(guildId);

    const [settings] = await db
      .select({ enabled: guild.consentEnabled, guidance: guild.consentGuidance })
      .from(guild)
      .where(eq(guild.id, guildId));

    if (!settings)
      throw new ActionError('Configure this guild before enabling consent checklists.');
    return settings;
  },
  'Could not load consent settings.',
);

export const saveConsentAdminSettings = asResult(
  'saveConsentAdminSettings',
  async (guildId: string, enabled: boolean, guidance: string) => {
    requireConsentAdminFeature();
    await ensureAdmin(guildId);

    if (typeof enabled !== 'boolean' || typeof guidance !== 'string' || guidance.length > 10000) {
      throw new ActionError('Invalid consent settings.');
    }

    await db.transaction(async (tx) => {
      // Lock the guild row so concurrent first-enable saves cannot both initialize topics.
      const [current] = await tx
        .select({ enabled: guild.consentEnabled, seededAt: guild.consentTopicsSeededAt })
        .from(guild)
        .where(eq(guild.id, guildId))
        .for('update');
      if (!current)
        throw new ActionError('Configure this guild before enabling consent checklists.');

      if (enabled && !current.enabled && !current.seededAt) {
        const existing = await tx
          .select({ id: consentTopic.id })
          .from(consentTopic)
          .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)))
          .limit(1);
        if (existing.length === 0) {
          const { parents, subtopics } = makeStarterConsentTopicRows(guildId);
          await tx.insert(consentTopic).values(parents);
          await tx.insert(consentTopic).values(subtopics);
        }
      }

      const [updated] = await tx
        .update(guild)
        .set({
          consentEnabled: enabled,
          consentGuidance: guidance.trim() || null,
          // Pre-existing enabled guilds or catalogs are already configured;
          // never inject defaults into a manually edited or emptied catalog.
          ...(!current.seededAt && (current.enabled || enabled)
            ? { consentTopicsSeededAt: new Date() }
            : {}),
        })
        .where(eq(guild.id, guildId))
        .returning({ id: guild.id });
      if (!updated)
        throw new ActionError('Configure this guild before enabling consent checklists.');
    });
    revalidatePath(`/g/${guildId}/admin`);
    return { enabled };
  },
  'Could not save consent settings.',
);
