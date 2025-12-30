import { headers } from 'next/headers';
import { auth } from '@/lib/auth';

export default async function LandingPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return <p>You are not logged in.</p>;
  }

  return <p>You are logged in.</p>;
}
