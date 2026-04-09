import { NextResponse } from 'next/server';
import {
  verifyInteraction,
  InteractionType,
  InteractionResponseType,
} from '@/lib/discord/interactions';
import * as v from 'valibot';
import { InteractionSchema } from '@/lib/discord/models';

export async function POST(req: Request) {
  const signature = req.headers.get('x-signature-ed25519');
  const timestamp = req.headers.get('x-signature-timestamp');

  if (!signature || !timestamp) {
    return new Response('Missing signature or timestamp', { status: 401 });
  }

  const rawBody = await req.text();

  const isValid = await verifyInteraction(signature, timestamp, rawBody);
  if (!isValid) {
    console.warn('Received Discord interaction with invalid signature');
    return new Response('Invalid request signature', { status: 401 });
  }

  try {
    const body = JSON.parse(rawBody);
    const result = v.safeParse(InteractionSchema, body);

    if (!result.success) {
      console.error('Invalid interaction body received from Discord:', result.issues);
      return new Response('Invalid interaction body', { status: 400 });
    }

    const interaction = result.output;

    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    console.log(`Received Discord interaction: Type ${interaction.type}, ID ${interaction.id}`);

    // Placeholder for other interaction types
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content: 'Interaction received!',
        flags: 64, // Ephemeral
      },
    });
  } catch (error) {
    console.error('Error processing Discord interaction:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
