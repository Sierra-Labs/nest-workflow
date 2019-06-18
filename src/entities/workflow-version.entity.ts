import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { User } from './user.entity';
import { Workflow } from './workflow.entity';
import { NodeSchemaVersion } from './node-schema-version.entity';

export enum WorkflowTrigger {
  Create = 'create',
  Read = 'read',
  Update = 'update',
  Delete = 'delete',
}

@Entity()
export class WorkflowVersion {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The workflow this version belongs to.',
  })
  workflowId: string;

  @ManyToOne(type => Workflow, { nullable: false })
  @JoinColumn({ name: 'workflow_id' })
  workflow: Workflow;

  @ApiModelProperty()
  @Column('int', {
    comment: 'Each version of the workflow will be increment by 1',
  })
  version: number;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelProperty()
  @Column('text')
  label: string;

  @ApiModelProperty()
  @Column('boolean', { default: false })
  isPublished: boolean;

  @Column('uuid', {
    comment: 'The version of the node schema associated to the workflow.',
  })
  nodeSchemaVersionId: string;

  @ApiModelProperty()
  @ManyToOne(type => NodeSchemaVersion, { nullable: false })
  @JoinColumn({ name: 'node_schema_version_id' })
  nodeSchemaVersion: NodeSchemaVersion;

  @ApiModelProperty()
  @Column('text')
  trigger: WorkflowTrigger;

  @ApiModelProperty()
  @Column('int', { default: 0 })
  position: number;

  @ApiModelPropertyOptional()
  @Column('jsonb', { nullable: true })
  config: any;

  @ApiModelPropertyOptional()
  @Column('jsonb', { nullable: true })
  sampleData: any;

  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @UpdateDateColumn({ select: false })
  modified: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
