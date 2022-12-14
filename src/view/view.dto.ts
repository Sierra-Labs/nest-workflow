import { User } from '../entities/user.entity';
import { NodeSchemaDto } from '../node/node-schema.dto';
import { ViewDataSourceType } from '../entities';

export class ViewTemplateDto {
  id?: string;
  organizationId?: number;
  versionId?: string;
  version?: number;
  name: string;
  dataSourceType: ViewDataSourceType;
  view?: any;
  viewMap?: Map<string, any>;
  nodeSchemaVersionId?: string;
  nodeSchema?: NodeSchemaDto;
  createdBy?: User;
  modifiedBy?: User;
}

export class FindViewTemplateDto {
  id: string;
  publishedVersionId: string;
  publishedName: string;
  publishedVersion: number;
  publishedDate: Date;
  latestVersionId: string;
  latestVersionName: string;
  latestVersion: number;
  latestVersionDate: Date;
}
