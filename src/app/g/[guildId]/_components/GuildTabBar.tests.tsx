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
  it('keeps one preferences tab without a separate checklist tab', () => {
    render(<GuildTabBar guildId="guild-1" isAdmin={false} />);
    expect(screen.queryByRole('link', { name: 'My Checklist' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Preferences' })).toHaveAttribute(
      'href',
      '/g/guild-1/preferences',
    );
  });
});
