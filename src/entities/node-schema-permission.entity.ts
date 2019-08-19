import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { User } from './user.entity';
import { NodeSchema } from './node-schema.entity';

export enum NodeSchemaPermissionType {
  Read = 'read',
  ReadWrite = 'read-write',
  ReadWriteDelete = 'read-write-delete',
}

@Entity()
@Unique(['nodeSchemaId', 'userNodeSchemaId'])
export class NodeSchemaPermission {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  public nodeSchemaId: string;

  @ManyToOne(type => NodeSchema, { nullable: false })
  @JoinColumn({ name: 'node_schema_id' })
  nodeSchema: NodeSchema;

  @ApiModelProperty()
  @Column('uuid')
  public userNodeSchemaId: string;

  @ManyToOne(type => NodeSchema, { nullable: false })
  @JoinColumn({ name: 'user_node_schema_id' })
  userNodeSchema: NodeSchema;

  @ApiModelProperty()
  @Column('text')
  permission: NodeSchemaPermissionType;

  @ApiModelProperty()
  @Column({ default: false })
  deleted: boolean;

  @ApiModelPropertyOptional()
  @CreateDateColumn()
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ApiModelPropertyOptional()
  @UpdateDateColumn()
  modified: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
