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

describe('coordinator status discovery', () => {
  it('shows aggregate access independently of coordinator-only completion access', () => {
    const { rerender } = render(
      <UserGameList
        guildId="guild-1"
        games={[{ ...game, canViewConsentAggregate: true, canViewConsentStatus: false }]}
      />,
    );
    expect(screen.getByRole('link', { name: 'View content boundaries' })).toHaveAttribute(
      'href',
      '/g/guild-1/games/game-1/consent/aggregate',
    );
    expect(screen.queryByRole('link', { name: 'View consent status' })).not.toBeInTheDocument();
    rerender(
      <UserGameList guildId="guild-1" games={[{ ...game, canViewConsentAggregate: false }]} />,
    );
    expect(screen.queryByRole('link', { name: 'View content boundaries' })).not.toBeInTheDocument();
  });
  it('shows a link only when the server authorizes the current member', () => {
    const { rerender } = render(
      <UserGameList guildId="guild-1" games={[{ ...game, canViewConsentStatus: true }]} />,
    );
    expect(screen.getByRole('link', { name: 'View consent status' })).toHaveAttribute(
      'href',
      '/g/guild-1/games/game-1/consent',
    );
    rerender(<UserGameList guildId="guild-1" games={[{ ...game, canViewConsentStatus: false }]} />);
    expect(screen.queryByRole('link', { name: 'View consent status' })).not.toBeInTheDocument();
  });
});
