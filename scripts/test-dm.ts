import { config } from '../src/lib/config';

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const [userId, guildId, type] = args.filter((arg) => !arg.startsWith('--'));

  if (!userId || !guildId || !type) {
    console.error('Usage: npx tsx scripts/test-dm.ts <userId> <guildId> <type> [--force]');
    console.error('Type can be: T7, T4C, T4O, T2');
    process.exit(1);
  }

  const url = `${config.siteUrl}/api/dev/notifications/test-dm`;
  console.log(`Triggering dev notification at ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, guildId, type, ignoreAllowedRecipients: force }),
    });

    const result = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error triggering dev notification:', error);
  }
}

main();
