import { config } from '../src/lib/config';

async function main() {
  const url = `${config.siteUrl}/api/cron/notifications`;
  console.log(`Triggering cron job at ${url}...`);
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${config.cronSecret}`,
    },
  });

  console.log(`Status: ${response.status} ${response.statusText}`);
  const data = await response.json().catch(() => null);
  if (data) {
    console.log('Response:', JSON.stringify(data, null, 2));
  } else {
    const text = await response.text();
    console.log('Response (text):', text);
  }

  if (!response.ok) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Error triggering cron job:', err);
  process.exit(1);
});
