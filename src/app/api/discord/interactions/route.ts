import { NextResponse } from 'next/server';
import {
  verifyInteraction,
  InteractionType,
  InteractionResponseType,
} from '@/lib/discord/interactions';
import * as v from 'valibot';
import { InteractionSchema } from '@/lib/discord/models';
import { db } from '@/db/db';
import { guild as guildTable } from '@/db/schema/guild';
import { eq } from 'drizzle-orm';
import { getGuildMember } from '@/lib/discord/api';
import { resolveRoleForGuild } from '@/lib/authn';
import { saveMemberPreference } from '@/actions/preferences';
import { saveAvailability } from '@/actions/availability';
import { getEditableMonths, isSameMonth, getDaysInMonth } from '@/lib/availability';
import { config } from '@/lib/config';
import { joinUrl } from '@/lib/urls';

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
      console.error(
        'Invalid interaction body received from Discord:',
        JSON.stringify(result.issues, null, 2),
        'Raw body:',
        rawBody,
      );
      return new Response('Invalid interaction body', { status: 400 });
    }

    const interaction = result.output;

    if (interaction.type === InteractionType.PING) {
      return NextResponse.json({ type: InteractionResponseType.PONG });
    }

    if (interaction.type === InteractionType.MESSAGE_COMPONENT) {
      const data = interaction.data as { custom_id: string; component_type: number };
      const customId = data.custom_id;

      if (customId?.startsWith('skip_month:') || customId.startsWith('pause_participation:')) {
        const [action, guildId, monthStr] = customId.split(':');
        const user = interaction.user || interaction.member?.user;

        if (!user) {
          return new Response('User not found in interaction', { status: 400 });
        }

        console.log(
          `Button clicked: ${action} by ${user.username} (${user.id}) for guild ${guildId}, month ${monthStr}`,
        );

        // 1. Validate guild exists in our webapp
        const [guildData] = await db.select().from(guildTable).where(eq(guildTable.id, guildId));
        if (!guildData) {
          console.warn(`Interaction for unknown guild: ${guildId}`);
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'This server is no longer configured in the webapp.',
              flags: 64, // Ephemeral
            },
          });
        }

        // 2. Validate user still has a valid role in the guild
        try {
          let roles: string[];
          if (interaction.member) {
            roles = interaction.member.roles;
          } else {
            console.log(`Fetching member for user ${user.id} in guild ${guildId} (DM interaction)`);
            const member = await getGuildMember({ guildId, userId: user.id });
            roles = member.roles;
          }

          const role = await resolveRoleForGuild(roles, guildId, guildData.allowedRoles);

          if (role === 'none') {
            console.warn(`User ${user.username} has no allowed roles in guild ${guildId}`);
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: 'You no longer have permission to perform this action in this server.',
                flags: 64, // Ephemeral
              },
            });
          }
        } catch (error) {
          console.error(`Error validating member ${user.id} in guild ${guildId}:`, error);
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: 'Could not verify your permissions. Please try again later.',
              flags: 64, // Ephemeral
            },
          });
        }

        if (action === 'pause_participation') {
          await saveMemberPreference({
            guildId,
            discordUserId: user.id,
            sessionsPerMonth: 0,
            displayName: user.global_name || user.username,
            notify: true,
            source: 'via Discord bot',
          });

          // 5. Respond to user
          const guildLink = joinUrl(config.siteUrl, `/g/${guildId}`);
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Got it! You are now set to not participating. If you ever change your mind, [Log into Tavern Master](${guildLink}) and set your preferences.`,
              flags: 64, // Ephemeral
            },
          });
        }

        if (action === 'skip_month') {
          const [year, month] = monthStr.split('-').map(Number);
          const targetMonth = { year, month };

          // Verify the month is still open for submission
          const editableMonths = getEditableMonths();
          const isAllowed = editableMonths.some((m) => isSameMonth(targetMonth, m));

          if (!isAllowed) {
            return NextResponse.json({
              type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
              data: {
                content: 'Sorry, that month is already passed.',
                flags: 64, // Ephemeral
              },
            });
          }

          // Generate unavailable status for all days
          const daysInMonth = getDaysInMonth(year, month);
          const days = Array.from({ length: daysInMonth }, (_, i) => ({
            day: i + 1,
            status: 'unavailable' as const,
          }));

          await saveAvailability({
            guildId,
            discordUserId: user.id,
            year,
            month,
            days,
            displayName: user.global_name || user.username,
            source: 'via Discord bot',
          });

          const availabilityLink = joinUrl(
            config.siteUrl,
            `/g/${guildId}/availability?year=${year}&month=${month}`,
          );
          return NextResponse.json({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: {
              content: `Got it! Thanks for letting me know. If you change your mind, [fill out your availability here](${availabilityLink}).`,
              flags: 64, // Ephemeral
            },
          });
        }

        return NextResponse.json({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            content: 'Acknowledged',
            flags: 64, // Ephemeral
          },
        });
      }
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
    return NextResponse.json({
      type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
      data: {
        content:
          'An unexpected error occurred while processing your request. Please try again later.',
        flags: 64, // Ephemeral
      },
    });
  }
}
