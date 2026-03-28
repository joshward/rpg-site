import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import Paper from './Paper';

const meta = {
  title: 'Components/Paper',
  component: Paper,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    children: { control: 'text' },
  },
} satisfies Meta<typeof Paper>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'This is a Paper component.',
  },
};
