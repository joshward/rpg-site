import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import Notification, { NotificationProvider, useNotification } from './Notification';
import Button from './Button';
import * as React from 'react';

const meta = {
  title: 'Components/Notification',
  component: Notification,
  decorators: [
    (Story) => (
      <NotificationProvider>
        <Story />
      </NotificationProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof Notification>;

export default meta;
type Story = StoryObj<typeof meta>;

const NotificationTrigger = ({
  type,
  title,
  description,
}: {
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description: string;
}) => {
  const notification = useNotification();
  return (
    <Button
      onClick={() =>
        notification.add({
          type,
          title,
          description,
        })
      }
    >
      Show {type} Notification
    </Button>
  );
};

export const Info: Story = {
  render: () => (
    <NotificationTrigger
      type="info"
      title="Info Notification"
      description="This is an informational message."
    />
  ),
};

export const Success: Story = {
  render: () => (
    <NotificationTrigger
      type="success"
      title="Success Notification"
      description="The operation was completed successfully."
    />
  ),
};

export const Warning: Story = {
  render: () => (
    <NotificationTrigger
      type="warning"
      title="Warning Notification"
      description="Please be careful with this action."
    />
  ),
};

export const Error: Story = {
  render: () => (
    <NotificationTrigger
      type="error"
      title="Error Notification"
      description="Something went wrong. Please try again."
    />
  ),
};
