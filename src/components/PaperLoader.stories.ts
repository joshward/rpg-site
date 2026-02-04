import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import PaperLoader from './PaperLoader';

const meta = {
  title: 'Components/PaperLoader',
  component: PaperLoader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PaperLoader>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
