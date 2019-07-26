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

@Entity()
@Unique(['nodeSchemaId', 'userNodeSchemaId'])
export class NodeSchemaPermission {
  @ApiModelProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @Column('uuid', {
    comment: 'The node schema this version belongs to.',
  })
  public nodeSchemaId: string;

  @ApiModelProperty()
  @Column('uuid')
  public userNodeSchemaId: string;

  @ApiModelProperty()
  @Column('text')
  permission: string;

  @ApiModelProperty()
  @Column({ default: false })
  deleted: boolean;

  @ApiModelPropertyOptional()
  @CreateDateColumn()
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'createdBy' })
  createdBy: User;

  @ApiModelPropertyOptional()
  @UpdateDateColumn()
  modified: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'modifiedBy' })
  modifiedBy: User;
}
