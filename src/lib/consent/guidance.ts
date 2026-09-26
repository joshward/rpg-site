export const DEFAULT_CONSENT_GUIDANCE = `# Content boundaries

Use this checklist to share topics you welcome, want kept behind a veil, or do not want included in a game. You can change your answers at any time. A heads-up means you'd like to know if a topic is likely to come up.

Your answers and private notes are visible to the Consent Coordinators for games you participate in. Other players see only the aggregate permitted by each game's settings. This checklist does not replace speaking up or checking in with one another during play.`;

export function getConsentGuidance(override: string | null): string {
  return override?.trim() ? override : DEFAULT_CONSENT_GUIDANCE;
}
