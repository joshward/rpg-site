import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

vi.mock('next/navigation', () => ({ usePathname: () => '/g/guild-1' }));
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import GuildTabBar from './GuildTabBar';

describe('guild navigation', () => {
  it('only links to a private checklist when the server says it is available', () => {
    const { rerender } = render(
      <GuildTabBar guildId="guild-1" isAdmin={false} showConsentChecklist={false} />,
    );
    expect(screen.queryByRole('link', { name: 'My Checklist' })).not.toBeInTheDocument();
    rerender(<GuildTabBar guildId="guild-1" isAdmin={false} showConsentChecklist />);
    expect(screen.getByRole('link', { name: 'My Checklist' })).toHaveAttribute(
      'href',
      '/g/guild-1/checklist',
    );
  });
});
