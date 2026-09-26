'use server';

import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { guild } from '@/db/schema/guild';
import { ensureAdmin } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { isConsentFeatureEnabled } from '@/lib/consent/feature-gate';

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

    const [updated] = await db
      .update(guild)
      .set({ consentEnabled: enabled, consentGuidance: guidance.trim() || null })
      .where(eq(guild.id, guildId))
      .returning({ id: guild.id });

    if (!updated) throw new ActionError('Configure this guild before enabling consent checklists.');
    revalidatePath(`/g/${guildId}/admin`);
    return { enabled };
  },
  'Could not save consent settings.',
);
