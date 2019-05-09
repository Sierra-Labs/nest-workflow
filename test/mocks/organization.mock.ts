import * as _ from 'lodash';

import { TestingModule } from '@nestjs/testing';

import { CreateOrganizationDto } from '../../src/organization/organization.dto';
import { OrganizationService } from '../../src/organization/organization.service';

export const MOCK_ORGANIZATION_DATA: CreateOrganizationDto[] = [
  {
    name: 'Sierra Labs',
    isAutoJoin: true,
    domainName: 'sierralabs.com',
  },
];

export class OrganizationMock {
  private organizationService: OrganizationService;

  constructor(private readonly module: TestingModule) {
    this.organizationService = module.get<OrganizationService>(
      OrganizationService,
    );
  }

  async generate() {
    for (const organizationDto of MOCK_ORGANIZATION_DATA) {
      await this.setupOrganization(organizationDto);
    }
    return Promise.resolve();
  }

  async setupOrganization(organizationDto: CreateOrganizationDto) {
    const organization = await this.organizationService.getByName(
      organizationDto.name,
    );
    if (!organization) {
      await this.organizationService.create(organizationDto);
    }
    return Promise.resolve();
  }
}
