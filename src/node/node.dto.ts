import { User } from '../entities/user.entity';

export class AttributeValueDto {
  nodeId: string;
  attributeId: string;
  id?: string;
  textValue?: string;
  numberValue?: number;
  dateTimeValue?: Date;
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
