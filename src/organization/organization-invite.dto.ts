export interface CreateOrganizationInviteDto {
  email: string;
  permissions: string[];
}

export interface OrganizationInviteDto {
  id: number;
  name: string;
  isAutoJoin: boolean;
  domainName: string;
  userCount?: number;
}
