import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { NodeSchema } from './node-schema.entity';
import { User } from './user.entity';

@Entity()
@Index(['name', 'isAutoJoin'])
export class Organization {
  @ApiModelProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelProperty()
  @Column('boolean', { default: false })
  isAutoJoin: boolean;

  @ApiModelPropertyOptional()
  @Column('text', { nullable: true })
  domainName: string;

  @ApiModelProperty()
  @OneToMany(type => NodeSchema, nodeSchema => nodeSchema.organization)
  nodeSchemas: NodeSchema[];

  @ApiModelProperty()
  @Column('boolean', { default: false, select: false })
  isDeleted: boolean;

  @ApiModelPropertyOptional()
  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ApiModelPropertyOptional()
  @UpdateDateColumn({ select: false })
  modified: Date;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
