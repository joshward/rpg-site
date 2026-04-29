import { config } from '../src/lib/config';
import { joinUrl } from '../src/lib/urls';

async function main() {
  const args = process.argv.slice(2);
  const [channelId, guildId, type] = args;

  if (!channelId || !guildId || !type) {
    console.error('Usage: npx tsx scripts/test-global.ts <channelId> <guildId> <type>');
    console.error('Type can be: T10, T3, T2G, T2A');
    process.exit(1);
  }

  const url = joinUrl(config.siteUrl, '/api/dev/notifications/test-global');
  console.log(`Triggering dev global notification at ${url}...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ channelId, guildId, type }),
    });

    const result = await response.json();
    console.log(`Status: ${response.status} ${response.statusText}`);
    console.log(`Response:`, JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error triggering dev global notification:', error);
  }
}

main();
