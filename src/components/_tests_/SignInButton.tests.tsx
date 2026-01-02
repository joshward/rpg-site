import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SignInButton from '../SignInButton';
import { authClient } from '@/lib/authClient';

vi.mock('@/lib/authClient', () => {
  const mockUseSession = vi.fn();
  const mockSignInSocial = vi.fn();

  return {
    authClient: {
      useSession: mockUseSession,
      signIn: {
        social: mockSignInSocial,
      },
    },
  };
});

vi.mock('next/navigation');

describe('SignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
    });
  });

  it('renders a Sign In button when not authenticated and calls signIn on click', async () => {
    render(<SignInButton />);

    const btn = screen.getByRole('button', { name: /log in/i });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    expect(authClient.signIn.social).toHaveBeenCalledTimes(1);
    expect(authClient.signIn.social).toHaveBeenCalledWith({
      callbackURL: '/',
      provider: 'discord',
    });
  });

  it('renders loading state when pending', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<SignInButton />);
    expect(screen.getByLabelText(/loading/i)).toBeInTheDocument();
  });

  it('renders user name when authenticated', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { user: { name: 'Alice' } } as any,
      isPending: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
    });

    render(<SignInButton />);
    expect(screen.getByText(/alice/i)).toBeInTheDocument();
  });
});
