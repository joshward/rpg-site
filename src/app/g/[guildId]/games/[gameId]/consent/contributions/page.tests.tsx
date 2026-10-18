import { expect, it, vi } from 'vitest';
const redirect = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ redirect }));
import LegacyContributionPage from './page';
it('redirects old contribution links to the safe, locked overview without reading private data', async () => {
  await LegacyContributionPage({
    params: Promise.resolve({ guildId: 'guild-1', gameId: 'game-1' }),
  });
  expect(redirect).toHaveBeenCalledWith('/g/guild-1/games/game-1/consent');
});
