import { redirect } from 'next/navigation';

/** Preserve the old aggregate URL; authorization happens in the overview read. */
export default async function LegacyAggregatePage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  redirect(`/g/${guildId}/games/${gameId}/consent`);
}
