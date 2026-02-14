import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Combobox from './Combobox';

const meta = {
  title: 'Components/Combobox',
  component: Combobox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    disabled: { control: 'boolean' },
    multiple: { control: 'boolean' },
  },
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const languages = [
  { id: 'js', label: 'JavaScript' },
  { id: 'ts', label: 'TypeScript' },
  { id: 'py', label: 'Python' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'java', label: 'Java' },
  { id: 'cpp', label: 'C++' },
  { id: 'csharp', label: 'C#' },
  { id: 'php', label: 'PHP' },
  { id: 'ruby', label: 'Ruby' },
];

export const Single: Story = {
  args: {
    items: languages,
    placeholder: 'Select a language',
  },
};

export const Multiple: Story = {
  args: {
    items: languages,
    multiple: true,
    placeholder: 'Select languages',
  },
};

export const Small: Story = {
  args: {
    items: languages,
    size: 'sm',
    placeholder: 'Small combobox',
  },
};

export const Medium: Story = {
  args: {
    items: languages,
    size: 'md',
    placeholder: 'Medium combobox',
  },
};

export const Large: Story = {
  args: {
    items: languages,
    size: 'lg',
    placeholder: 'Large combobox',
  },
};

export const Disabled: Story = {
  args: {
    items: languages,
    disabled: true,
    placeholder: 'Disabled combobox',
  },
};

export const LongList: Story = {
  args: {
    items: Array.from({ length: 50 }, (_, i) => ({ id: i, label: `Option ${i + 1}` })),
    placeholder: 'Select an option',
  },
};
