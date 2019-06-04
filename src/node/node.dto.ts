import { User } from '../entities/user.entity';

export class AttributeValueDto {
  id?: string;
  attributeId: string;
  textValue?: string;
  numberValue?: number;
  dateValue?: Date;
  timeValue?: string;
  jsonValue?: any;
  referenceNodeId?: string;
  referenceNode?: NodeDto;
  isDeleted?: boolean;
}

export class NodeDto {
  id?: string;
  organizationId?: number;
  versionId: string;
  nodeSchemaVersionId?: string;
  attributeValues: AttributeValueDto[];
  createdBy?: User;
  modifiedBy?: User;
}
