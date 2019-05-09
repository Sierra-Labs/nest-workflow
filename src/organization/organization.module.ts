import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '@sierralabs/nest-identity';

import { OrganizationDomainBlacklist } from '../entities/organization-domain-blacklist.entity';
import { OrganizationInvite } from '../entities/organization-invite.entity';
import { Organization } from '../entities/organization.entity';
import { UserModule } from '../user/user.module';
import { OrganizationController } from './organization.controller';
import { OrganizationService } from './organization.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationDomainBlacklist,
      OrganizationInvite,
    ]),
    forwardRef(() => UserModule),
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService, AuthService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
