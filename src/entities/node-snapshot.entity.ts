import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty } from '@nestjs/swagger';

import { User } from './user.entity';
import { NodeSchemaVersion } from './node-schema-version.entity';
import { Node } from './node.entity';
import { AttributeValue } from './attribute-value.entity';

@Entity()
export class NodeSnapshot {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The reference to the node that this snapshot belongs to.',
  })
  nodeId: string;

  @ApiModelProperty()
  @ManyToOne(type => Node, { nullable: false })
  @JoinColumn({ name: 'node_id' })
  node: Node;

  @Column('uuid', {
    comment:
      'The version of the node schema associated to the node snapshot and its attributes.',
  })
  nodeSchemaVersionId: string;

  @ApiModelProperty()
  @ManyToOne(type => NodeSchemaVersion, { nullable: false })
  @JoinColumn({ name: 'node_schema_version_id' })
  nodeSchemaVersion: NodeSchemaVersion;

  @ApiModelProperty()
  @Column('jsonb')
  attributeValues: AttributeValue[];

  @ApiModelProperty()
  @Column('boolean', { default: false, select: false })
  isDeleted: boolean;

  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
