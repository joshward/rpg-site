import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Switch from '../Switch';

describe('Switch', () => {
  it('supports label clicks, keyboard activation and uncontrolled state', async () => {
    const user = userEvent.setup();
    render(<Switch label="Notifications" description="Save to apply." />);
    const control = screen.getByRole('switch', { name: 'Notifications' });
    expect(control).not.toBeChecked();
    expect(control).toHaveAccessibleDescription('Save to apply.');
    await user.click(screen.getByText('Notifications'));
    expect(control).toBeChecked();
    control.focus();
    await user.keyboard(' ');
    expect(control).not.toBeChecked();
  });
  it('supports controlled state and unique per-item accessible labels', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [checked, setChecked] = useState(false);
      return (
        <Switch
          label="Coordinator"
          aria-label="Coordinator: Player"
          checked={checked}
          onCheckedChange={setChecked}
        />
      );
    }
    render(<Harness />);
    const control = screen.getByRole('switch', { name: 'Coordinator: Player' });
    await user.click(control);
    expect(control).toBeChecked();
  });
  it('does not change a disabled or read-only switch', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(
      <>
        <Switch label="Disabled" disabled onCheckedChange={change} />
        <Switch label="Read only" readOnly onCheckedChange={change} />
      </>,
    );
    await user.click(screen.getByText('Disabled'));
    await user.click(screen.getByRole('switch', { name: 'Read only' }));
    expect(change).not.toHaveBeenCalled();
    expect(screen.getByRole('switch', { name: 'Disabled' })).not.toBeChecked();
  });
  it('submits normal form values only when the form is explicitly submitted', async () => {
    const user = userEvent.setup();
    const submit = vi.fn();
    render(
      <form
        aria-label="Settings"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <Switch label="Enabled" name="enabled" value="yes" />
        <button type="submit">Save</button>
      </form>,
    );
    const control = screen.getByRole('switch', { name: 'Enabled' });
    await user.click(control);
    expect(new FormData(screen.getByRole('form') as HTMLFormElement).get('enabled')).toBe('yes');
    expect(submit).not.toHaveBeenCalled();
    control.focus();
    await user.keyboard('{Enter}');
    expect(submit).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(submit).toHaveBeenCalledOnce();
  });
});
