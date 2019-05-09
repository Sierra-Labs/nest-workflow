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

import { OrganizationPermissionType } from '../organization/organization-permission';
import { OrganizationInvite } from './organization-invite.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity()
@Index(['user', 'organization'], { unique: true })
export class UserOrganization {
  @ApiModelProperty()
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ApiModelPropertyOptional()
  @ManyToOne(type => OrganizationInvite, { nullable: true })
  @JoinColumn({ name: 'organization_invite_id' })
  organizationInvite: OrganizationInvite;

  @ManyToOne(type => Organization, { nullable: false, eager: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column('text')
  permission: OrganizationPermissionType;

  @ApiModelPropertyOptional()
  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
