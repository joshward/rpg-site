import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MarkdownEditor from '../MarkdownEditor';
import MarkdownPreview from '../MarkdownPreview';

describe('MarkdownEditor', () => {
  it('keeps the raw controlled draft through preview/edit without writing or submitting', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const submit = vi.fn();
    function Harness() {
      const [value, setValue] = useState('**Shared**');
      return (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <MarkdownEditor
            label="Note"
            name="note"
            value={value}
            onValueChange={(next) => {
              change(next);
              setValue(next);
            }}
          />
        </form>
      );
    }
    render(<Harness />);
    await user.type(screen.getByRole('textbox', { name: 'Note' }), ' draft');
    const changes = change.mock.calls.length;
    await user.click(screen.getByRole('switch', { name: 'Preview Note' }));
    expect(screen.getByRole('region', { name: 'Note' }).querySelector('strong')).toHaveTextContent(
      'Shared',
    );
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(new FormData(screen.getByRole('region').closest('form')!).get('note')).toBe(
      '**Shared** draft',
    );
    await user.click(screen.getByRole('switch', { name: 'Preview Note' }));
    expect(screen.getByRole('textbox', { name: 'Note' })).toHaveValue('**Shared** draft');
    expect(change).toHaveBeenCalledTimes(changes);
    expect(submit).not.toHaveBeenCalled();
  });
  it('associates labels, guidance and errors and enforces the native length limit', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [value, setValue] = useState('');
      return (
        <MarkdownEditor
          label="Note"
          description="Shared only."
          error="Draft kept."
          maxLength={4}
          value={value}
          onValueChange={setValue}
        />
      );
    }
    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Note' });
    expect(input).toHaveAccessibleDescription('Shared only. Draft kept.');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    await user.type(input, 'abcdef');
    expect(input).toHaveValue('abcd');
  });
  it('shows external updates and an empty preview without changing the value', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    const { rerender } = render(<MarkdownEditor label="Note" value="" onValueChange={change} />);
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText('Nothing to preview yet.')).toBeInTheDocument();
    rerender(<MarkdownEditor label="Note" value="# Updated" onValueChange={change} />);
    expect(screen.getByRole('heading', { name: 'Updated' })).toBeInTheDocument();
    rerender(
      <MarkdownEditor
        label="Note"
        value="![Alt only](https://example.invalid/tracker.png)"
        onValueChange={change}
      />,
    );
    expect(screen.getByText('Alt only')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('keeps disabled inputs and preview controls disabled', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<MarkdownEditor label="Note" value="Draft" onValueChange={change} disabled />);
    expect(screen.getByRole('textbox')).toBeDisabled();
    await user.click(screen.getByRole('switch'));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(change).not.toHaveBeenCalled();
  });
  it('does not edit read-only text but still lets the user preview it', async () => {
    const user = userEvent.setup();
    const change = vi.fn();
    render(<MarkdownEditor label="Note" value="**Draft**" onValueChange={change} readOnly />);
    await user.type(screen.getByRole('textbox'), 'extra');
    await user.click(screen.getByRole('switch'));
    expect(screen.getByText('Draft').tagName).toBe('STRONG');
    expect(change).not.toHaveBeenCalled();
  });
});

describe('Markdown rendering safety', () => {
  it('does not load images or execute HTML/unsafe link schemes in consent content', () => {
    const { container } = render(
      <MarkdownPreview
        allowImages={false}
        content={
          '![Tracker](https://example.invalid/tracker.png)\n\n<script>alert(1)</script>\n\n[Unsafe](javascript:alert%281%29)\n\n[Safe](https://example.invalid/info)'
        }
      />,
    );
    expect(screen.getByText('Tracker')).toBeInTheDocument();
    expect(container.querySelector('img,script,iframe')).toBeNull();
    expect(screen.getByText('Unsafe')).not.toHaveAttribute(
      'href',
      expect.stringMatching(/^javascript:/i),
    );
    expect(screen.getByRole('link', { name: 'Safe' })).toHaveAttribute(
      'href',
      'https://example.invalid/info',
    );
  });
  it('preserves existing opt-in image rendering for game descriptions', () => {
    render(<MarkdownPreview content="![Map](https://example.invalid/map.png)" allowImages />);
    expect(screen.getByRole('img', { name: 'Map' })).toHaveAttribute(
      'src',
      'https://example.invalid/map.png',
    );
  });
});
