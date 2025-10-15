import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeToggle from '../ThemeToggle';

// Dynamically controlled mock for next-themes
const mockSetTheme = vi.fn();
let resolvedTheme: 'light' | 'dark' = 'dark';
vi.mock('next-themes', () => ({
  useTheme: () => ({ resolvedTheme, setTheme: mockSetTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockReset();
    resolvedTheme = 'dark';
  });

  it('renders the button and does not show the placeholder after mount', async () => {
    render(<ThemeToggle />);

    // Wait for the mounted state
    const button = await screen.findByRole('button');
    expect(button).toBeInTheDocument();

    // Ensure the loading placeholder is not present after mount
    expect(document.querySelector('.animate-pulse')).toBeNull();
  });

  it('when current resolvedTheme is dark, it toggles to light on click', async () => {
    resolvedTheme = 'dark';
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: /toggle to light mode/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });

  it('when current resolvedTheme is light, it toggles to dark on click', async () => {
    resolvedTheme = 'light';
    render(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: /toggle to dark mode/i });
    expect(button).toBeInTheDocument();

    await userEvent.click(button);
    expect(mockSetTheme).toHaveBeenCalledTimes(1);
    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });
});
