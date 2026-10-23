import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import Switch from './Switch';

const meta = {
  title: 'Components/Switch',
  component: Switch,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { label: 'Enable consent checklists', defaultChecked: false },
} satisfies Meta<typeof Switch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Checked: Story = { args: { defaultChecked: true } };
export const Disabled: Story = { args: { disabled: true, defaultChecked: true } };
export const WithDescription: Story = {
  args: { description: 'This change takes effect when you save your settings.' },
};
export const Controlled: Story = {
  render: function ControlledSwitch(args) {
    const [checked, setChecked] = useState(false);
    return <Switch {...args} checked={checked} onCheckedChange={setChecked} />;
  },
};
