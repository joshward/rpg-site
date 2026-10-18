import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import UserGameList from '../UserGameList';

const game = {
  id: 'game-1',
  name: 'Campaign',
  description: null,
  status: 'active' as const,
  sessionsPerMonth: 2,
  isRequired: true,
  members: [],
};

describe('consent overview discovery', () => {
  it('shows one overview link for members and coordinators, never separate status links', () => {
    const { rerender } = render(
      <UserGameList
        guildId="guild-1"
        games={[{ ...game, canViewConsentAggregate: true, canViewConsentStatus: true }]}
      />,
    );
    expect(screen.getAllByRole('link', { name: 'Consent overview' })).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Consent overview' })).toHaveAttribute(
      'href',
      '/g/guild-1/games/game-1/consent',
    );
    expect(screen.queryByRole('link', { name: 'View consent status' })).not.toBeInTheDocument();
    rerender(
      <UserGameList
        guildId="guild-1"
        games={[{ ...game, canViewConsentAggregate: true, canViewConsentStatus: false }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Consent overview' })).toBeInTheDocument();
    rerender(
      <UserGameList guildId="guild-1" games={[{ ...game, canViewConsentAggregate: false }]} />,
    );
    expect(screen.queryByRole('link', { name: 'Consent overview' })).not.toBeInTheDocument();
  });
});
