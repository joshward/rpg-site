'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { DiscordLogoIcon, PersonIcon } from '@radix-ui/react-icons';
import { Menu } from '@base-ui/react/menu';
import { authClient } from '@/lib/authClient';
import Button from '@/components/Button';

interface SignInButtonProps {
  signInText?: string;
}

export default function SignInButton({ signInText = 'Log In' }: SignInButtonProps) {
  const { data, isPending, error } = authClient.useSession();
  const router = useRouter();

  useEffect(() => {
    if (error) {
      // TODO - handle error properly
      console.error('Error signing in:', error);
    }
  }, [error]);

  const signIn = async () => {
    await authClient.signIn.social({
      provider: 'discord',
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
