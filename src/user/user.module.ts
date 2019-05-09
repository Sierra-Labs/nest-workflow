import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthService } from '@sierralabs/nest-identity';

import { User } from '../entities/user.entity';
import { OrganizationModule } from '../organization/organization.module';
import { RolesModule } from '../roles/roles.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    RolesModule,
    forwardRef(() => OrganizationModule),
  ],
  providers: [UserService, AuthService],
  controllers: [UserController],
  exports: [UserService, AuthService],
})
export class UserModule {}
