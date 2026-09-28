'use server';

import { and, eq, isNull, asc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@/db/db';
import { consentTopic } from '@/db/schema/consent-topics';
import { ensureAdmin } from '@/actions/auth-helpers';
import { ActionError, asResult } from '@/actions/action-helpers';
import { isConsentFeatureEnabled } from '@/lib/consent/feature-gate';

export type OfficialConsentTopic = {
  id: string;
  parentTopicId: string | null;
  name: string;
};

async function ensureTopicAdmin(guildId: string) {
  if (!isConsentFeatureEnabled()) throw new ActionError('Consent checklists are not available.');
  const access = await ensureAdmin(guildId);
  if (!access.guildData?.consentEnabled) {
    throw new ActionError('Enable consent checklists for this guild before editing topics.');
  }
}

function normalizeName(name: string): string {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120) {
    throw new ActionError('Topic names must be between 1 and 120 characters.');
  }
  return name.trim();
}

function officialInGuild(guildId: string, id: string) {
  return and(
    eq(consentTopic.guildId, guildId),
    eq(consentTopic.id, id),
    isNull(consentTopic.ownerDiscordUserId),
  );
}

async function ensureUniqueOfficialName(
  guildId: string,
  parentTopicId: string | null,
  name: string,
  excludeId?: string,
) {
  const siblings = await db
    .select({ id: consentTopic.id, name: consentTopic.name })
    .from(consentTopic)
    .where(
      and(
        eq(consentTopic.guildId, guildId),
        isNull(consentTopic.ownerDiscordUserId),
        parentTopicId === null
          ? isNull(consentTopic.parentTopicId)
          : eq(consentTopic.parentTopicId, parentTopicId),
      ),
    );
  if (
    siblings.some(
      (topic) => topic.id !== excludeId && topic.name.trim().toLowerCase() === name.toLowerCase(),
    )
  ) {
    throw new ActionError('An identical topic already exists at this level.');
  }
}

function refreshTopics(guildId: string) {
  revalidatePath(`/g/${guildId}/admin`);
}

export const getOfficialConsentTopics = asResult(
  'getOfficialConsentTopics',
  async (guildId: string): Promise<OfficialConsentTopic[]> => {
    await ensureTopicAdmin(guildId);
    return db
      .select({
        id: consentTopic.id,
        parentTopicId: consentTopic.parentTopicId,
        name: consentTopic.name,
      })
      .from(consentTopic)
      .where(and(eq(consentTopic.guildId, guildId), isNull(consentTopic.ownerDiscordUserId)))
      .orderBy(asc(consentTopic.sortOrder), asc(consentTopic.createdAt), asc(consentTopic.name));
  },
  'Could not load consent topics.',
);

export const addOfficialConsentTopic = asResult(
  'addOfficialConsentTopic',
  async (
    guildId: string,
    name: string,
    parentTopicId: string | null,
  ): Promise<OfficialConsentTopic> => {
    await ensureTopicAdmin(guildId);
    const normalizedName = normalizeName(name);
    if (parentTopicId !== null) {
      if (typeof parentTopicId !== 'string' || !parentTopicId) {
        throw new ActionError('Choose a valid parent topic.');
      }
      const [parent] = await db
        .select({ parentTopicId: consentTopic.parentTopicId })
        .from(consentTopic)
        .where(officialInGuild(guildId, parentTopicId));
      if (!parent || parent.parentTopicId !== null) {
        throw new ActionError('Subtopics must belong to a main topic in this guild.');
      }
    }
    await ensureUniqueOfficialName(guildId, parentTopicId, normalizedName);

    const [created] = await db
      .insert(consentTopic)
      .values({ guildId, name: normalizedName, parentTopicId })
      .returning({
        id: consentTopic.id,
        parentTopicId: consentTopic.parentTopicId,
        name: consentTopic.name,
      });
    refreshTopics(guildId);
    return created;
  },
  'Could not add consent topic.',
);

export const renameOfficialConsentTopic = asResult(
  'renameOfficialConsentTopic',
  async (guildId: string, id: string, name: string, answerChoice: 'keep' | 'clear') => {
    await ensureTopicAdmin(guildId);
    const normalizedName = normalizeName(name);
    if (answerChoice !== 'keep' && answerChoice !== 'clear') {
      throw new ActionError('Choose whether to keep or clear existing answers.');
    }
    const [current] = await db
      .select({ parentTopicId: consentTopic.parentTopicId })
      .from(consentTopic)
      .where(officialInGuild(guildId, id));
    if (!current) throw new ActionError('Topic not found.');
    await ensureUniqueOfficialName(guildId, current.parentTopicId, normalizedName, id);

    // There are no player-answer tables yet. Before adding them, this action
    // must clear answers, heads-up, and notes transactionally for 'clear'.
    const [updated] = await db
      .update(consentTopic)
      .set({ name: normalizedName })
      .where(officialInGuild(guildId, id))
      .returning({ id: consentTopic.id });
    if (!updated) throw new ActionError('Topic not found.');
    refreshTopics(guildId);
  },
  'Could not rename consent topic.',
);

export const deleteOfficialConsentTopic = asResult(
  'deleteOfficialConsentTopic',
  async (guildId: string, id: string) => {
    await ensureTopicAdmin(guildId);
    const [deleted] = await db
      .delete(consentTopic)
      .where(officialInGuild(guildId, id))
      .returning({ id: consentTopic.id });
    if (!deleted) throw new ActionError('Topic not found.');
    // DB foreign key cascades from parent to its subtopics.
    refreshTopics(guildId);
  },
  'Could not remove consent topic.',
);
