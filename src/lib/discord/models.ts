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

export const UserSchema = v.object({
  id: v.string(),
  username: v.string(),
  global_name: v.nullish(v.string()),
  avatar: v.nullish(v.string()),
  bot: v.nullish(v.boolean()),
});
export type UserModel = v.InferOutput<typeof UserSchema>;

export const GuildMemberSchema = v.object({
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
});
export type MessageModel = v.InferOutput<typeof MessageSchema>;

export const ChannelsResponseSchema = v.array(ChannelSchema);
export type ChannelsResponseModel = v.InferOutput<typeof ChannelsResponseSchema>;

export const InteractionSchema = v.object({
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
});
export type InteractionModel = v.InferOutput<typeof InteractionSchema>;
