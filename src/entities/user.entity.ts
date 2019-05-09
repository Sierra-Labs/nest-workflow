import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  ManyToMany,
  JoinTable,
  OneToMany,
} from 'typeorm';
import { ApiModelProperty } from '@nestjs/swagger';
import { Role } from './role.entity';
import { ReplaceRelationType } from '@sierralabs/nest-utils';
import { User as BaseUser } from '@sierralabs/nest-identity';
import { Organization } from './organization.entity';
import { UserOrganization } from './user-organization.entity';

@Entity()
export class User extends BaseUser {
  @ApiModelProperty()
  @ManyToOne(type => Organization, { nullable: true, eager: true })
  @JoinColumn({ name: 'active_organization_id' })
  activeOrganization: Organization;

  @ApiModelProperty()
  @OneToMany(
    type => UserOrganization,
    userOrganization => userOrganization.user,
    { eager: true },
  )
  userOrganizations: UserOrganization[];

  /**
   * Need to redeclare roles relationship from base class
   */
  @ReplaceRelationType(type => Role)
  public roles: Role[];
}
