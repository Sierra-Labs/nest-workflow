import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity()
@Index(['organization', 'email'], { unique: true })
export class OrganizationInvite {
  @ApiModelProperty()
  @PrimaryGeneratedColumn()
  id: number;

  /**
   * The organization that the user is invited to join
   */
  @ApiModelProperty()
  @ManyToOne(type => Organization, { nullable: false, eager: true })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  /**
   * The email of the user that is being invited
   */
  @ApiModelProperty()
  @Column('citext')
  public email: string;

  @Column('text', { array: true })
  permissions: string[];

  @ApiModelPropertyOptional()
  @CreateDateColumn()
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
