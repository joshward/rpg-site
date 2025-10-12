import SignInButton from '@/components/SignInButton';

export default function Home() {
  console.log('url: ', process.env.BETTER_AUTH_URL);
  return (
    <div>
      <SignInButton />
    </div>
  );
}
