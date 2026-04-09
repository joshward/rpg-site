import { config } from '@/lib/config';

/**
 * Converts a hex string to a Uint8Array.
 */
function hexToUint8Array(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)));
}

/**
 * Verifies the signature of a Discord interaction request.
 * Uses the Web Crypto API (crypto.subtle).
 */
export async function verifyInteraction(
  signature: string,
  timestamp: string,
  rawBody: string,
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(config.discord.publicKey) as any,
      { name: 'Ed25519', namedCurve: 'Ed25519' } as any,
      false,
      ['verify'],
    );

    const encoder = new TextEncoder();
    const data = encoder.encode(timestamp + rawBody);
    const signatureArray = hexToUint8Array(signature);

    return await crypto.subtle.verify('Ed25519', key, signatureArray as any, data as any);
  } catch (error) {
    console.error('Interaction verification failed:', error);
    return false;
  }
}

export enum InteractionType {
  PING = 1,
  APPLICATION_COMMAND = 2,
  MESSAGE_COMPONENT = 3,
  APPLICATION_COMMAND_AUTOCOMPLETE = 4,
  MODAL_SUBMIT = 5,
}

export enum InteractionResponseType {
  PONG = 1,
  CHANNEL_MESSAGE_WITH_SOURCE = 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE = 5,
  DEFERRED_UPDATE_MESSAGE = 6,
  UPDATE_MESSAGE = 7,
  APPLICATION_COMMAND_AUTOCOMPLETE_RESULT = 8,
  MODAL = 9,
  PREMIUM_REQUIRED = 10,
}
