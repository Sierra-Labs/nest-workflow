import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Unique,
  OneToMany,
} from 'typeorm';

import { ApiModelProperty } from '@nestjs/swagger';

import { NodeSchema } from './node-schema.entity';
import { User } from './user.entity';
import { Attribute } from './attribute.entity';

@Entity()
@Unique(['nodeSchemaId', 'version'])
export class NodeSchemaVersion {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The node schema this version belongs to.',
  })
  nodeSchemaId: string;

  @ManyToOne(type => NodeSchema, { nullable: false })
  @JoinColumn({ name: 'node_schema_id' })
  nodeSchema: NodeSchema;

  @ApiModelProperty()
  @Column('int', {
    comment: 'Each version of the node schema will be increment by 1',
  })
  version: number;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelProperty()
  @Column('text', { default: 'custom' })
  type: string; // TODO: turn into enum

  @ApiModelProperty()
  @Column('boolean', { default: false })
  isPublished: boolean;

  @OneToMany(type => Attribute, attribute => attribute.nodeSchemaVersion)
  attributes: Attribute[];

  @OneToMany(
    type => Attribute,
    attribute => attribute.referencedNodeSchemaVersion,
  )
  attributeBackReferences: Attribute[];

  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @UpdateDateColumn({ select: true })
  modified: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
