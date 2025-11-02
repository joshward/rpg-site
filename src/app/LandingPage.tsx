'use client';

import { authClient } from '@/lib/authClient';

export default function LandingPage() {
  const { data } = authClient.useSession();

  // for now in the code we are assuming that the user is assigned to a single guild
  const role = data?.roles[0];

  // placeholder code - this will provide custom menu logic based on user's roles
  if (!role) {
    return <p>You are not assigned to any guilds in this site.</p>;
  }

  return (
    <p>
      You are assigned to guild {role.guildId} ({role.role})
    </p>
  );
}
