import * as v from 'valibot';

export const ErrorSchema = v.object({
  code: v.number(),
  message: v.string(),
  errors: v.optional(v.looseObject({})),
});
export type ErrorModel = v.InferOutput<typeof ErrorSchema>;

export const GuildSchema = v.object({
  id: v.string(),
  name: v.string(),
  icon: v.nullish(v.string()),
  owner_id: v.nullish(v.string()),
});
export type GuildModel = v.InferOutput<typeof GuildSchema>;

export const GuildsResponseSchema = v.array(GuildSchema);
export type GuildsResponseModel = v.InferOutput<typeof GuildsResponseSchema>;

export const RoleSchema = v.object({
  id: v.string(),
  name: v.string(),
  permissions: v.string(),
});
export type RoleModel = v.InferOutput<typeof RoleSchema>;

export const RolesResponseSchema = v.array(RoleSchema);
export type RolesResponseModel = v.InferOutput<typeof RolesResponseSchema>;

export const UserSchema = v.looseObject({
  id: v.string(),
  username: v.string(),
  global_name: v.nullish(v.string()),
  avatar: v.nullish(v.string()),
  bot: v.nullish(v.boolean()),
});
export type UserModel = v.InferOutput<typeof UserSchema>;

export const GuildMemberSchema = v.looseObject({
  user: UserSchema,
  roles: v.array(v.string()),
  nick: v.nullish(v.string()),
});
export type GuildMemberModel = v.InferOutput<typeof GuildMemberSchema>;

export const GuildMembersResponseSchema = v.array(GuildMemberSchema);
export type GuildMembersResponseModel = v.InferOutput<typeof GuildMembersResponseSchema>;

export const ChannelSchema = v.object({
  id: v.string(),
  name: v.nullish(v.string()),
  type: v.number(),
  guild_id: v.optional(v.string()),
  permissions: v.optional(v.string()),
  permission_overwrites: v.optional(
    v.array(
      v.object({
        id: v.string(),
        type: v.number(),
        allow: v.string(),
        deny: v.string(),
      }),
    ),
  ),
});
export type ChannelModel = v.InferOutput<typeof ChannelSchema>;

export const MessageSchema = v.object({
  id: v.string(),
  content: v.string(),
  flags: v.optional(v.number()),
});
export type MessageModel = v.InferOutput<typeof MessageSchema>;

export const EmbedFooterSchema = v.object({
  text: v.string(),
  icon_url: v.optional(v.string()),
  proxy_icon_url: v.optional(v.string()),
});

export const EmbedImageSchema = v.object({
  url: v.string(),
  proxy_url: v.optional(v.string()),
  height: v.optional(v.number()),
  width: v.optional(v.number()),
});

export const EmbedThumbnailSchema = v.object({
  url: v.string(),
  proxy_url: v.optional(v.string()),
  height: v.optional(v.number()),
  width: v.optional(v.number()),
});

export const EmbedAuthorSchema = v.object({
  name: v.string(),
  url: v.optional(v.string()),
  icon_url: v.optional(v.string()),
  proxy_icon_url: v.optional(v.string()),
});

export const EmbedFieldSchema = v.object({
  name: v.string(),
  value: v.string(),
  inline: v.optional(v.boolean()),
});

export const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  USER_SELECT: 5,
  ROLE_SELECT: 6,
  MENTIONABLE_SELECT: 7,
  CHANNEL_SELECT: 8,
  SECTION: 9,
  TEXT_DISPLAY: 10,
  THUMBNAIL: 11,
  MEDIA_GALLERY: 12,
  FILE: 13,
  SEPARATOR: 14,
  CONTAINER: 17,
} as const;

export const MessageFlags = {
  CROSSPOSTED: 1 << 0,
  IS_CROSSPOST: 1 << 1,
  SUPPRESS_EMBEDS: 1 << 2,
  SOURCE_MESSAGE_DELETED: 1 << 3,
  URGENT: 1 << 4,
  HAS_THREAD: 1 << 5,
  EPHEMERAL: 1 << 6,
  LOADING: 1 << 7,
  FAILED_TO_MENTION_SOME_ROLES_IN_THREAD: 1 << 8,
  SUPPRESS_NOTIFICATIONS: 1 << 12,
  IS_VOICE_MESSAGE: 1 << 13,
  HAS_SNAPSHOT: 1 << 14,
  IS_COMPONENTS_V2: 1 << 15,
} as const;

export const ButtonStyle = {
  PRIMARY: 1,
  SECONDARY: 2,
  SUCCESS: 3,
  DANGER: 4,
  LINK: 5,
} as const;

export const ButtonComponentSchema = v.object({
  type: v.literal(ComponentType.BUTTON),
  style: v.number(),
  label: v.optional(v.string()),
  emoji: v.optional(
    v.object({
      id: v.optional(v.string()),
      name: v.optional(v.string()),
      animated: v.optional(v.boolean()),
    }),
  ),
  custom_id: v.optional(v.string()),
  url: v.optional(v.string()),
  disabled: v.optional(v.boolean()),
});

export const TextDisplaySchema = v.object({
  type: v.literal(ComponentType.TEXT_DISPLAY),
  content: v.string(),
});

export const ContainerSchema = v.object({
  type: v.literal(ComponentType.CONTAINER),
  components: v.array(v.looseObject({})),
  accent_color: v.optional(v.number()),
  spoiler: v.optional(v.boolean()),
});

export const SectionSchema = v.object({
  type: v.literal(ComponentType.SECTION),
  components: v.array(v.looseObject({})),
  accessory: v.optional(v.looseObject({})),
});

export const ActionRowSchema = v.object({
  type: v.literal(ComponentType.ACTION_ROW),
  components: v.array(v.looseObject({})), // Simplification for now, as it can contain buttons or selects
});

export const MessageComponentSchema = v.union([
  ActionRowSchema,
  ButtonComponentSchema,
  TextDisplaySchema,
  ContainerSchema,
  SectionSchema,
]);
export type MessageComponentModel = v.InferOutput<typeof MessageComponentSchema>;

export const EmbedSchema = v.object({
  title: v.optional(v.string()),
  type: v.optional(v.string()),
  description: v.optional(v.string()),
  url: v.optional(v.string()),
  timestamp: v.optional(v.string()),
  color: v.optional(v.number()),
  footer: v.optional(EmbedFooterSchema),
  image: v.optional(EmbedImageSchema),
  thumbnail: v.optional(EmbedThumbnailSchema),
  author: v.optional(EmbedAuthorSchema),
  fields: v.optional(v.array(EmbedFieldSchema)),
});
export type EmbedModel = v.InferOutput<typeof EmbedSchema>;

export const ChannelsResponseSchema = v.array(ChannelSchema);
export type ChannelsResponseModel = v.InferOutput<typeof ChannelsResponseSchema>;

export const InteractionSchema = v.looseObject({
  id: v.string(),
  application_id: v.string(),
  type: v.number(),
  token: v.string(),
  version: v.number(),
  guild_id: v.optional(v.string()),
  channel_id: v.optional(v.string()),
  member: v.optional(GuildMemberSchema),
  user: v.optional(UserSchema),
  data: v.optional(v.looseObject({})),
  message: v.optional(v.looseObject({})),
});
export type InteractionModel = v.InferOutput<typeof InteractionSchema>;
