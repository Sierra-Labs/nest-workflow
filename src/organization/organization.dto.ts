import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';
import { User } from '../entities/user.entity';
import { OrganizationPermissionType } from './organization-permission';

export class CreateOrganizationDto {
  @ApiModelProperty()
  name: string;
  @ApiModelProperty()
  isAutoJoin: boolean;
  @ApiModelPropertyOptional()
  domainName: string;
  createdBy?: User;
  modifiedBy?: User;
}

export class UserOrganizationDto {
  @ApiModelProperty()
  userOrganizationId: number;
  @ApiModelProperty()
  organizationId: number;
  @ApiModelProperty()
  userId: number;
  @ApiModelProperty()
  firstName: string;
  @ApiModelProperty()
  lastName: string;
  @ApiModelProperty()
  email: string;
  @ApiModelProperty()
  permission: OrganizationPermissionType;
  @ApiModelProperty()
  created: Date;
}

export class UserOrganizationInviteDto {
  @ApiModelProperty()
  organizationInviteId: number;
  @ApiModelProperty()
  organizationId: number;
  @ApiModelProperty()
  email: string;
  @ApiModelProperty()
  permission: OrganizationPermissionType;
  @ApiModelProperty()
  created: Date;
}

export class GetOrganizationUserDto {
  @ApiModelProperty()
  userOrganizations: UserOrganizationDto[];
  @ApiModelProperty()
  organizationInvites: UserOrganizationInviteDto[];
}

export class UpdateUserOrganizationDto {
  permission: OrganizationPermissionType;
}
