import { UserNodeSchemaPermissionDto } from './user-node-schema-permission.dto';

export class NodeSchemaPermissionDto {
  nodeSchemaId?: string;
  name: string;
  label: string;
  userNodeSchemaPermissions: UserNodeSchemaPermissionDto[];
}
