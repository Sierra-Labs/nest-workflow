import { OrganizationPermissionType } from './organization-permission';

export interface CreateOrganizationInviteDto {
  email: string;
  permission: OrganizationPermissionType;
}

export interface OrganizationInviteDto {
  id: number;
  name: string;
  isAutoJoin: boolean;
  domainName: string;
  userCount?: number;
}
