import { redirect } from 'next/navigation';

/** Private contribution data is now lazy-loaded only in the unlocked overview. */
export default async function LegacyContributionPage({
  params,
}: {
  params: Promise<{ guildId: string; gameId: string }>;
}) {
  const { guildId, gameId } = await params;
  redirect(`/g/${guildId}/games/${gameId}/consent`);
}
