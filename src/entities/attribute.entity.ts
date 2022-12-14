import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { User } from './user.entity';
import { NodeSchemaVersion } from './node-schema-version.entity';
import { AttributeType } from '../node';

export enum ReferenceType {
  OneToOne = 'one-to-one',
  OneToMany = 'one-to-many',
  ManyToOne = 'many-to-one',
  ManyToMany = 'many-to-many',
}
@Entity()
export class Attribute {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The version of the node schema associated to the attribute.',
  })
  nodeSchemaVersionId: string;

  @ApiModelProperty()
  @ManyToOne(type => NodeSchemaVersion, { nullable: false })
  @JoinColumn({ name: 'node_schema_version_id' })
  nodeSchemaVersion: NodeSchemaVersion;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelProperty()
  @Column('text')
  label: string;

  @ApiModelProperty()
  @Column('text')
  type: AttributeType;

  @ApiModelProperty()
  @Column('int', { default: 0 })
  position: number;

  @ApiModelPropertyOptional()
  @Column('jsonb', { nullable: true })
  options: any; // configuration such as setting minLength, maxLength, scale, precision, selections, etc.

  @Column('uuid', {
    nullable: true,
    comment:
      'If attribute type is a reference, then this fields stores the referenced node schema version.',
  })
  referencedNodeSchemaVersionId: string;

  @ApiModelProperty()
  @ManyToOne(type => NodeSchemaVersion, { nullable: true })
  @JoinColumn({ name: 'referenced_node_schema_version_id' })
  referencedNodeSchemaVersion: NodeSchemaVersion;

  @ApiModelProperty()
  @Column('text', {
    nullable: true,
    comment:
      'The type of reference relationship: one-to-one, one-to-many, many-to-many',
  })
  referenceType: ReferenceType;

  @Column('boolean', { default: false })
  isRequired: boolean;

  @Column('boolean', { default: false, select: false })
  isDeleted: boolean;

  // system assigned property for back reference attributes
  // this is not a database table column; see NodeSchema.mapToNodeSchemaDto()
  isBackReference: boolean;

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
