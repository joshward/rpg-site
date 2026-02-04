import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import GuildIcon from './GuildIcon';

const meta = {
  title: 'Components/GuildIcon',
  component: GuildIcon,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof GuildIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const WithIcon: Story = {
  args: {
    guild: {
      id: '123456789',
      name: 'Test Guild',
      icon: 'some-icon-hash',
    },
  },
};

export const Fallback: Story = {
  args: {
    guild: {
      id: '123456789',
      name: 'Test Guild',
      icon: null,
    },
  },
};
