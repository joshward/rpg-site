export type PlausibleEvents = {
  submit_availability: { guildId: string; year: number; month: number };
  update_preferences: { guildId: string; sessionsPerMonth: number };
  save_schedule: { guildId: string; year: number; month: number };
  update_member_preference: { guildId: string; discordUserId: string; sessionsPerMonth: number };
  create_game: { guildId: string };
  update_game: { guildId: string; gameId: string };
};
