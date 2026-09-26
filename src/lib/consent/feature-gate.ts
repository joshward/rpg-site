// Server-side gate for all future consent-sheet reads and writes. Do not use a
// NEXT_PUBLIC_ variable or rely on hiding UI controls for authorization.
// Production remains off unless the value is explicitly set to "true".
export function isConsentFeatureEnabled(): boolean {
  return process.env.CONSENT_FEATURE_ENABLED === 'true';
}

export type ConsentGameMode = 'off' | 'optional' | 'requested';

/** Guild checklist access is independent of whether any particular game is On. */
export function canAccessGuildConsent(guildEnabled: boolean): boolean {
  return isConsentFeatureEnabled() && guildEnabled === true;
}

/** Game-level views and actions also require that the game is On. */
export function canAccessGameConsent(guildEnabled: boolean, gameMode: ConsentGameMode): boolean {
  return (
    canAccessGuildConsent(guildEnabled) && (gameMode === 'optional' || gameMode === 'requested')
  );
}
