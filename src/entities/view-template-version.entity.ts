import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty } from '@nestjs/swagger';

import { NodeSchemaVersion } from './node-schema-version.entity';
import { User } from './user.entity';
import { ViewTemplate } from './view-template.entity';

export enum ViewDataSourceType {
  Custom = 'custom',
  Node = 'node',
  Query = 'query',
}
@Entity()
@Unique(['viewTemplateId', 'version'])
export class ViewTemplateVersion {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The view template this version belongs to.',
  })
  viewTemplateId: string;

  @ManyToOne(type => ViewTemplate, { nullable: false })
  @JoinColumn({ name: 'view_template_id' })
  viewTemplate: ViewTemplate;

  @ApiModelProperty()
  @Column('int', { comment: 'Each version of the view will be increment by 1' })
  version: number;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelProperty()
  @Column('text', { default: 'custom' })
  dataSourceType: ViewDataSourceType;

  @ApiModelProperty()
  @Column('text', {
    nullable: true, // first version won't have a URL immediately until save
    comment: 'The URL to where the view template JSON file is located',
  })
  templateUrl: string;

  @ApiModelProperty()
  @Column('boolean', { default: false })
  isPublished: boolean;

  @Column('uuid', {
    nullable: true,
    comment: 'The node schema version to match with the template.',
  })
  nodeSchemaVersionId: string;

  @ManyToOne(type => NodeSchemaVersion, { nullable: true })
  @JoinColumn({ name: 'node_schema_version_id' })
  nodeSchemaVersion: NodeSchemaVersion;

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
