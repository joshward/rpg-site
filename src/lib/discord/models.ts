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
  icon: v.optional(v.string()),
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
});
export type UserModel = v.InferOutput<typeof UserSchema>;

export const GuildMemberSchema = v.object({
  user: UserSchema,
  roles: v.array(v.string()),
});
export type GuildMemberModel = v.InferOutput<typeof GuildMemberSchema>;
