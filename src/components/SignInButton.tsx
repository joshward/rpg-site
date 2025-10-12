'use client';

import { authClient } from '@/lib/authClient';

export default function SignInButton() {
  const { data, isPending, error } = authClient.useSession();

  if (isPending) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  if (data) {
    return <p>Logged in: {data.user.name}</p>;
  }

  const signIn = async () => {
    await authClient.signIn.social({
      provider: 'discord',
    });
  };

  return <button onClick={signIn}>Sign In</button>;
}
