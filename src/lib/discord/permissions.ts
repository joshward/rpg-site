export enum Permissions {
  Administrator,
}

const permissionsValues: Record<Permissions, bigint> = {
  [Permissions.Administrator]: BigInt(8),
};

export const hasPermission = (userPermissions: string, permission: Permissions) =>
  (BigInt(userPermissions) & permissionsValues[permission]) === permissionsValues[permission];
