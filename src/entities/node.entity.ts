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

import { ApiModelProperty } from '@nestjs/swagger';

import { User } from './user.entity';
import { NodeSchemaVersion } from './node-schema-version.entity';
import { AttributeValue } from './attribute-value.entity';

@Entity()
export class Node {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment:
      'The version of the node schema associated to the node and its attributes.',
  })
  nodeSchemaVersionId: string;

  @ApiModelProperty()
  @ManyToOne(type => NodeSchemaVersion, { nullable: false })
  @JoinColumn({ name: 'node_schema_version_id' })
  nodeSchemaVersion: NodeSchemaVersion;

  @Column('int', {
    nullable: true,
    comment:
      'A user associated to the node when `nodeSchemaVersion.type === user`.',
  })
  referenceUserId: number;

  @ApiModelProperty()
  @ManyToOne(type => User, { nullable: true })
  @JoinColumn({ name: 'reference_user_id' })
  referenceUser: User;

  @ApiModelProperty()
  @OneToMany(type => AttributeValue, attributeValue => attributeValue.node)
  attributeValues: AttributeValue[];

  @Column('boolean', { default: false, select: false })
  isDeleted: boolean;

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
