import { User } from '../entities/user.entity';
import { Attribute } from '../entities/attribute.entity';
export class NodeSchemaDto {
  id?: string;
  organizationId?: number;
  versionId?: string;
  name: string;
  type: string;
  attributes?: Attribute[];
  removedAttributes?: Attribute[];
  createdBy?: User;
  modifiedBy?: User;
}

export class FindNodeSchemaDto {
  id: string;
  publishedVersionId: string;
  publishedName: string;
  publishedVersion: number;
  publishedType: string;
  publishedDate: Date;
  latestVersionId: string;
  latestVersionName: string;
  latestVersionType: string;
  latestVersion: number;
  latestVersionDate: Date;
}
