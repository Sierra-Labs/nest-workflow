import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { User } from './user.entity';

@Entity()
export class OrganizationDomainBlacklist {
  @ApiModelProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ApiModelProperty()
  @Column('text')
  @Index({ unique: true })
  domainName: string;

  @ApiModelPropertyOptional()
  @CreateDateColumn()
  created: Date;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @ApiModelPropertyOptional()
  @UpdateDateColumn()
  modified: Date;

  @ManyToOne(type => User)
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
