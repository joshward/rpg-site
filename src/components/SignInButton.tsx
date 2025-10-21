'use client';

import { authClient } from '@/lib/authClient';
import Button from '@/components/Button';
import { DiscordLogoIcon, PersonIcon } from '@radix-ui/react-icons';
import { useEffect } from 'react';

export default function SignInButton() {
  const { data, isPending, error } = authClient.useSession();

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

  const handleClick = async () => {
    if (!data) {
      await signIn();
    }
  };

  return (
    <Button asLoader={isPending} size="lg" onClick={handleClick}>
      {data ? (
        <>
          <PersonIcon />
          {data.user.name}
        </>
      ) : (
        <>
          <DiscordLogoIcon />
          Log In
        </>
      )}
    </Button>
  );
}
