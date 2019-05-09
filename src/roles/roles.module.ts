import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RolesGuard } from '@sierralabs/nest-identity';
import { Role } from '../entities/role.entity';
import { RolesService } from './roles.service';

@Module({
  imports: [TypeOrmModule.forFeature([Role])],
  providers: [RolesService, RolesGuard],
  controllers: [],
  exports: [RolesService, RolesGuard],
})
export class RolesModule {}
