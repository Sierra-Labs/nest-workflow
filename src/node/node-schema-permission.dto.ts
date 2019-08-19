export class UserNodeSchemaPermissionDto {
  nodeSchemaPermissionId?: string;
  userNodeSchemaId: string;
  name: string;
  label: string;
  permission: string;
  deleted: boolean;
}

export class NodeSchemaPermissionDto {
  nodeSchemaId: string;
  name: string;
  label: string;
  userNodeSchemaPermissions: UserNodeSchemaPermissionDto[];
}
