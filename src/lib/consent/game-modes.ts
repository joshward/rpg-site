// This small module can be shared by the server schema and the client form.
export const gameConsentModeEnum = ['off', 'optional', 'requested'] as const;
export type GameConsentMode = (typeof gameConsentModeEnum)[number];
