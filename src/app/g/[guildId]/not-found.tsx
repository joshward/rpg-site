import Paper from '@/components/Paper';

export default function GuildNotFound() {
  return (
    <Paper className="items-center">
      <p className="text-2xl font-bold">404</p>
      <p>This guild does not exist or you are not a member.</p>
    </Paper>
  );
}
