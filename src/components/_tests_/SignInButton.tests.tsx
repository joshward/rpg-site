import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock the better-auth client used by the component
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

// Import after mock is set up
import SignInButton from '../SignInButton';
import { authClient } from '@/lib/authClient';

describe('SignInButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it('renders a Sign In button when not authenticated and calls signIn on click', async () => {
    render(<SignInButton />);

    const btn = screen.getByRole('button', { name: /sign in/i });
    expect(btn).toBeInTheDocument();

    await userEvent.click(btn);

    expect(authClient.signIn.social).toHaveBeenCalledTimes(1);
    expect(authClient.signIn.social).toHaveBeenCalledWith({ provider: 'discord' });
  });

  it('renders loading state when pending', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignInButton />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('renders user name when authenticated', () => {
    vi.mocked(authClient.useSession).mockReturnValue({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: { user: { name: 'Alice' } } as any,
      isPending: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<SignInButton />);
    expect(screen.getByText(/logged in: alice/i)).toBeInTheDocument();
  });
});
