export const config = {
  discord: {
    apiUrl: 'https://discord.com/api/v10',
    clientId: process.env.DISCORD_CLIENT_ID ?? '',
    clientSecret: process.env.DISCORD_CLIENT_SECRET ?? '',
    botToken: process.env.DISCORD_BOT_TOKEN ?? '',
  },
  databaseUrl: process.env.DATABASE_URL ?? '',
} as const;
