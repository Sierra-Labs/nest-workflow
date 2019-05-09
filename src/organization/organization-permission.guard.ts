import * as _ from 'lodash';

import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { extendArrayMetadata } from '@nestjs/common/utils/extend-metadata.util';
import { Reflector } from '@nestjs/core';
import { RolesGuard, RolesType } from '@sierralabs/nest-identity';

import { User } from '../entities/user.entity';
import { OrganizationPermissionType } from './organization-permission';

/**
 * Setup `@OrganizationPermission` decorator
 * @param permissions
 */
export const OrganizationPermission = (...permissions: string[]) => (
  target,
  key?,
  descriptor?,
) => {
  const roles = [RolesType.$authenticated]; // use RolesGuard to make sure user is authenticated
  if (descriptor) {
    // Store metadata on the roles and permissions that should access the method.
    Reflect.defineMetadata('roles', roles, descriptor.value);
    Reflect.defineMetadata('permissions', permissions, descriptor.value);

    // List the methods that have @Roles(...) declared at the target (class) level.
    // This is needed to handle class inheritance when using @InheritRoles()
    extendArrayMetadata(
      'role:properties',
      [{ key, value: descriptor.value }],
      target.constructor,
    );
    extendArrayMetadata(
      'permission:properties',
      [{ key, value: descriptor.value }],
      target.constructor,
    );

    // Store metadata to use the RolesGuard for the method.
    extendArrayMetadata(
      GUARDS_METADATA,
      [OrganizationPermissionGuard],
      descriptor.value,
    );

    return descriptor;
  }
  Reflect.defineMetadata('roles', roles, target);
  Reflect.defineMetadata('permissions', permissions, target);
  extendArrayMetadata(GUARDS_METADATA, [OrganizationPermissionGuard], target);
  return target;
};

@Injectable()
export class OrganizationPermissionGuard extends RolesGuard
  implements CanActivate {
  constructor(protected readonly reflector: Reflector) {
    super(reflector);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const handler = context.getHandler();
    const request = context.switchToHttp().getRequest();
    const isAuthenticated = await super.canActivate(context);
    if (!isAuthenticated) {
      return false; // not authenticated
    }

    // get user from request object
    const user: User = request.user || { roles: [] };
    if (!user.roles) {
      user.roles = [];
    }
    if (_.find(user.roles, { name: 'Admin' })) {
      return true; // Admin users can access all organizations
    }

    // check if organizationId is passed to request
    const organizationId =
      Number(request.params.organizationId) || Number(request.params.id);
    if (!organizationId) {
      throw new UnprocessableEntityException(
        'No organization ID found in request',
      );
    }

    // check if user has permission
    const permissions =
      this.reflector.get<OrganizationPermissionType[]>(
        'permissions',
        handler,
      ) || [];

    if (permissions.length === 0) {
      throw new UnprocessableEntityException('No permission specified.');
    }
    for (const permission of permissions) {
      if (
        _.find(user.userOrganizations, {
          organization: { id: organizationId },
          permission,
        })
      ) {
        return true;
      }
    }
    return false;
  }
}
