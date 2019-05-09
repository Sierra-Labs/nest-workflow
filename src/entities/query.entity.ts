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
import { Organization } from './organization.entity';

@Entity()
export class Query {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', {
    comment: 'The organization for the query.',
  })
  organizationId: number;

  @ManyToOne(type => Organization, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ApiModelProperty()
  @Column('text')
  name: string;

  @ApiModelPropertyOptional()
  @Column('jsonb', { nullable: true })
  select: string[];

  @ApiModelPropertyOptional()
  @Column('text', { nullable: true })
  sql: string;

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
