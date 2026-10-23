import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import MarkdownEditor from './MarkdownEditor';

const meta = {
  title: 'Components/MarkdownEditor',
  component: MarkdownEditor,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    label: 'Group note',
    value:
      '## At the table\n\nKeep **combat** cinematic.\n\n- Fade to black when requested.\n- Check in before returning to a sensitive topic.',
    onValueChange: () => {},
    maxLength: 10000,
  },
  render: function EditorStory(args) {
    const [value, setValue] = useState(args.value);
    return <MarkdownEditor {...args} value={value} onValueChange={setValue} />;
  },
} satisfies Meta<typeof MarkdownEditor>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { value: '', placeholder: 'Write a shared group note...' } };
export const WithDescription: Story = {
  args: { description: 'This is shared text, not a private player note.' },
};
export const WithError: Story = { args: { error: 'This note changed. Your draft has been kept.' } };
export const Disabled: Story = { args: { disabled: true } };
export const ReadOnly: Story = { args: { readOnly: true } };
export const ImagePrivacy: Story = {
  args: {
    value:
      '![Alt text only](https://example.invalid/image.png)\n\nConsent previews never request this image.',
  },
};
