import { describe, expect, it } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { Toast } from '@base-ui/react/toast';
import Notification, { NotificationProvider } from '../Notification';
import * as React from 'react';

describe('Notification', () => {
  it('renders correctly', async () => {
    const manager = Toast.createToastManager();

    const TestComponent = () => {
      return (
        <Toast.Provider toastManager={manager}>
          <NotificationProvider>
            <div />
          </NotificationProvider>
        </Toast.Provider>
      );
    };

    render(<TestComponent />);
    // Just verify it doesn't crash and renders the region
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});
