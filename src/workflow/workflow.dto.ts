import { WorkflowTrigger } from '../entities/workflow-version.entity';
import { User } from '../entities';
import { MachineConfig } from 'xstate';
import { WorkflowContext } from './workflow.machine';

export class WorkflowDto {
  id?: string;
  organizationId?: number;
  versionId?: string;
  name: string;
  label: string;
  nodeSchemaVersionId: string;
  triggers: WorkflowTrigger[];
  position: number;
  config: MachineConfig<WorkflowContext, any, any>;
  sampleData: any;
  createdBy?: User;
  modifiedBy?: User;
}

export class FindWorkflowDto {
  id: string;
  publishedVersionId: string;
  publishedName: string;
  publishedLabel: string;
  publishedVersion: number;
  publishedType: string;
  publishedDate: Date;
  latestVersionId: string;
  latestVersionName: string;
  latestVersionLabel: string;
  latestVersionType: string;
  latestVersion: number;
  latestVersionDate: Date;
}
