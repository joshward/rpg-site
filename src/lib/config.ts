function requireEnvVar(name: string): string {
  const value = process.env[name];
  if (typeof value === 'undefined' || value === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const config = {
  discord: {
    apiUrl: 'https://discord.com/api/v10',
    clientId: requireEnvVar('DISCORD_CLIENT_ID'),
    clientSecret: requireEnvVar('DISCORD_CLIENT_SECRET'),
    botToken: requireEnvVar('DISCORD_BOT_TOKEN'),
  },
  databaseUrl: requireEnvVar('DATABASE_URL'),
  siteUrl: requireEnvVar('SITE_URL'),
} as const;
