import { EntityManager, Repository } from 'typeorm';

import { MailerProvider } from '@nest-modules/mailer';
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
} from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { UserService as BaseUserService } from '@sierralabs/nest-identity';
import { ConfigService } from '@sierralabs/nest-utils';

import { UserOrganization } from '../entities/user-organization.entity';
import { User } from '../entities/user.entity';
import { OrganizationPermissionType } from '../organization/organization-permission';
import { CreateOrganizationDto } from '../organization/organization.dto';
import { OrganizationService } from '../organization/organization.service';
import { RolesService } from '../roles/roles.service';
import { RegisterDto } from './user.dto';

Injectable();
export class UserService extends BaseUserService {
  constructor(
    @InjectRepository(User) protected readonly userRepository: Repository<User>,
    protected readonly configService: ConfigService,
    protected readonly rolesService: RolesService,
    protected readonly moduleRef: ModuleRef,
    @Inject('MailerProvider') protected readonly mailerProvider: MailerProvider,
    @InjectEntityManager() protected readonly entityManager: EntityManager,
    @Inject(forwardRef(() => OrganizationService))
    protected readonly organizationService: OrganizationService,
  ) {
    super(
      userRepository,
      configService,
      rolesService,
      moduleRef,
      mailerProvider,
    );
  }

  /**
   * Override base userService.register() with custom validation
   * @param userDto
   */
  public async register(userDto: RegisterDto): Promise<User> {
    let user = this.userRepository.create(userDto);
    delete user.id; // remove id to ensure that no existing user gets overwritten
    user.verified = false;
    if (userDto.token) {
      const { email } = this.authService.verifyToken(userDto.token);
      user.verified = email === userDto.email;
    }

    if (user.password) {
      user = (await this.changePassword(user, user.password)) as User;
    }

    let newUser;
    try {
      newUser = await this.userRepository.save(user);
    } catch (error) {
      if (error.constraint === 'user__email__uq') {
        throw new ConflictException(
          'Duplicate email. Please try a different email address.',
        );
      } else {
        throw error;
      }
    }
    if (!user.verified) {
      this.sendRegistrationEmail(newUser);
    }

    return newUser;
  }

  /**
   * Override base userService.update() with custom validation
   * @param user
   */
  public async update(user: User): Promise<User> {
    user.id = Number(user.id); // force id to be a number
    delete user.createdBy; // don't save the createdBy field

    // validate organization related changes
    if (user.activeOrganization) {
      if (!user.activeOrganization.id) {
        // if no organization id specified then remove from update
        delete user.activeOrganization;
      } else {
        // validate user belongs in organization
        const userCheck = await this.userRepository
          .createQueryBuilder('user')
          .innerJoin('user.userOrganizations', 'userOrganizations')
          .where(
            'user.id = :userId AND userOrganizations.organization_id = :organizationId',
            {
              userId: user.id,
              organizationId: user.activeOrganization.id,
            },
          )
          .getOne();
        if (!userCheck) {
          throw new BadRequestException(
            'User does not belong to this organization.',
          );
        }
      }
    }
    await this.userRepository.save(user);
    return this.findById(user.id) as Promise<User>;
  }

  /**
   * Create an organization, make the user an admin in the organization,
   * and create a root folder for the organization
   * @param userId
   * @param organizationDto
   */
  public async createOrganization(
    userId: number,
    organizationDto: CreateOrganizationDto,
  ): Promise<UserOrganization> {
    let newUserOrganization;
    await this.entityManager.transaction(async transactionalEntityManager => {
      // create the organization
      const organization = await this.organizationService.create(
        organizationDto,
        transactionalEntityManager,
      );
      // create a user_organization record
      const user = new User();
      user.id = userId;
      const userOrganization = new UserOrganization();
      userOrganization.user = user;
      userOrganization.createdBy = organizationDto.createdBy;
      userOrganization.organization = organization;
      userOrganization.permission = OrganizationPermissionType.Admin;
      newUserOrganization = await transactionalEntityManager.save(
        userOrganization,
      );
      // make organization active for the user
      user.activeOrganization = organization;
      await transactionalEntityManager.save(user);
    });
    return newUserOrganization;
  }
}
