import { Injectable } from '@nestjs/common';
import { Role } from '../entities/role.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RolesService as BaseRolesService } from '@sierralabs/nest-identity';

@Injectable()
export class RolesService extends BaseRolesService {
  constructor(
    @InjectRepository(Role) protected readonly roleRepository: Repository<Role>,
  ) {
    super(roleRepository);
  }

  public static checkRole(roles: Role[], roleName: string) {
    return roles
      .map(role => role.name.toLowerCase())
      .includes(roleName.toLowerCase());
  }
}
