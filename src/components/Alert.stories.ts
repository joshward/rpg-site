import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import Alert from './Alert';

const meta = {
  title: 'Components/Alert',
  component: Alert,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    type: {
      control: 'select',
      options: ['error', 'warning'],
    },
    children: { control: 'text' },
  },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Error: Story = {
  args: {
    type: 'error',
    children: 'This is an error alert',
  },
};

export const Warning: Story = {
  args: {
    type: 'warning',
    children: 'This is a warning alert',
  },
};
