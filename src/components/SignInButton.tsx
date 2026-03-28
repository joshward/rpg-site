'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DiscordLogoIcon, PersonIcon } from '@radix-ui/react-icons';
import { Menu } from '@base-ui/react/menu';
import { authClient } from '@/lib/authClient';
import Button from '@/components/Button';
import { useNotification } from '@/components/Notification';

interface SignInButtonProps {
  signInText?: string;
}

export default function SignInButton({ signInText = 'Log In' }: SignInButtonProps) {
  const { data, isPending, error } = authClient.useSession();
  const router = useRouter();
  const notification = useNotification();

  useEffect(() => {
    if (error) {
      notification.add({
        title: 'Error signing in',
        description: error.message || 'An unexpected error occurred.',
        type: 'error',
      });
    }
  }, [error, notification]);

  const signIn = async () => {
    await authClient.signIn.social({
      provider: 'discord',
      callbackURL: window.location.pathname,
    });
  };

  const signOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/');
        },
      },
    });
  };

  const handleClick = async () => {
    if (!data) {
      await signIn();
    }
  };

  if (!data) {
    return (
      <Button
        loading={isPending}
        loadingLabel="Loading Login Button"
        size="lg"
        onClick={handleClick}
      >
        <DiscordLogoIcon />
        {signInText}
      </Button>
    );
  }

  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button size="lg">
            <PersonIcon />
            {data.user.name}
          </Button>
        }
      />
      <Menu.Portal>
        <Menu.Positioner sideOffset={5}>
          <Menu.Popup>
            <Menu.Item
              nativeButton
              render={<Button size="md" variant="danger" />}
              onClick={signOut}
            >
              Log Out
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
