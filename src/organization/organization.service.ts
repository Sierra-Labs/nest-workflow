import * as _ from 'lodash';
import { EntityManager, Repository } from 'typeorm';

import { MailerService } from '@nest-modules/mailer';
import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectEntityManager, InjectRepository } from '@nestjs/typeorm';
import { AuthService, JwtPayload, JwtToken } from '@sierralabs/nest-identity';
import { ConfigService } from '@sierralabs/nest-utils';

import { User } from '../entities/user.entity';
import { OrganizationDomainBlacklist } from '../entities/organization-domain-blacklist.entity';
import { OrganizationInvite } from '../entities/organization-invite.entity';
import { Organization } from '../entities/organization.entity';
import { UserOrganization } from '../entities/user-organization.entity';
import { UserService } from '../user/user.service';
import {
  CreateOrganizationInviteDto,
  OrganizationInviteDto,
} from './organization-invite.dto';
import {
  CreateOrganizationDto,
  GetOrganizationUserDto,
} from './organization.dto';

@Injectable()
export class OrganizationService {
  private logger = new Logger('OrganizationService');

  constructor(
    @InjectRepository(Organization)
    protected readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationDomainBlacklist)
    protected readonly organizationDomainBlacklistRepository: Repository<
      OrganizationDomainBlacklist
    >,
    @InjectRepository(OrganizationInvite)
    protected readonly organizationInviteRepository: Repository<
      OrganizationInvite
    >,
    @InjectEntityManager() protected readonly entityManager: EntityManager,
    protected readonly mailerProvider: MailerService,
    protected readonly authService: AuthService,
    protected readonly configService: ConfigService,
    @Inject(forwardRef(() => UserService))
    protected readonly userService: UserService,
  ) {}

  public async create(
    organizationDto: CreateOrganizationDto,
    transactionalEntityManager?: EntityManager,
  ) {
    if (!organizationDto.name) {
      throw new BadRequestException('Name is required.');
    }
    const organization = new Organization();
    // make sure organization name is lower case for unique name check
    organization.name = organizationDto.name;
    organization.isAutoJoin = organizationDto.isAutoJoin;
    organization.domainName = organizationDto.domainName;
    organization.createdBy = organizationDto.createdBy;
    organization.modifiedBy = organizationDto.modifiedBy;
    if (organization.isAutoJoin) {
      // Check if there's a dupliate name
      const duplicateOrganization = await this.organizationRepository
        .createQueryBuilder('organization')
        .where('name ILIKE :name AND is_auto_join = true', {
          name: organization.name.toLowerCase(),
        })
        .getOne();
      if (duplicateOrganization) {
        throw new BadRequestException(
          'Duplicate name found with auto joining of email addresses from the same organization. Please enter a different team name.',
        );
      }
    }
    if (transactionalEntityManager) {
      return transactionalEntityManager.save(organization);
    } else {
      return this.organizationRepository.save(organization);
    }
  }

  public async getByName(name: string): Promise<Organization> {
    return this.organizationRepository.findOne({ where: { name } });
  }

  public async getUsers(
    organizationId: number,
  ): Promise<GetOrganizationUserDto> {
    const userOrganizations = await this.entityManager
      .createQueryBuilder(UserOrganization, 'uo')
      .select([
        'uo.id as "userOrganizationId"',
        'uo.organization_id as "organizationId"',
        'uo.user_id as "userId"',
        'u.first_name as "firstName"',
        'u.last_name as "lastName"',
        'u.email as "email"',
        'uo.permissions as "permissions"',
        'uo.created as "created"',
      ])
      .innerJoin('uo.user', 'u')
      .where('uo.organization_id = :organizationId', { organizationId })
      .orderBy('u.firstName')
      .getRawMany();
    const organizationInvites = await this.entityManager
      .createQueryBuilder(OrganizationInvite, 'oi')
      .select([
        'oi.id as "organizationInviteId"',
        'oi.organization_id as "organizationId"',
        'oi.email as "email"',
        'oi.permissions as "permissions"',
        'oi.created as "created"',
      ])
      .where(
        `oi.organization_id = :organizationId AND NOT EXISTS (
          SELECT 1 FROM user_organization WHERE organization_invite_id = oi.id
        )`,
        { organizationId },
      )
      .orderBy('oi.email')
      .getRawMany();
    return { userOrganizations, organizationInvites };
  }

  /**
   * Get a user's invites and available organizations to join
   * @param userId
   * @param email
   */
  public async getUserInvites(
    userId: number,
    email: string,
  ): Promise<OrganizationInviteDto[]> {
    if (!email) {
      throw new BadRequestException('No email specified');
    }
    const columns = [
      'organization.id as "id"',
      'organization.name as "name"',
      'organization.is_auto_join as "isAutoJoin"',
      'organization.domain_name as "domainName"',
      `(SELECT COUNT(uo.id) FROM "user_organization" as uo WHERE uo.organization_id = organization.id) as "userCount"`,
    ];
    // organization that user has explicitly been invited to
    const invitedOrganizations = await this.organizationRepository
      .createQueryBuilder('organization')
      .select(columns)
      .innerJoin(
        'organization_invite',
        'invite',
        'invite.organization_id = organization.id AND email = :email',
        {
          email,
        },
      )
      .leftJoin(
        'user_organization',
        'uo',
        'uo.organization_id = organization.id AND user_id = :userId',
        {
          userId,
        },
      )
      .where('organization.is_deleted = false AND uo.user_id IS NULL')
      .groupBy('organization.id')
      .getRawMany();
    // organization that have auto join set up
    const domainName = email.replace(/.*@/, '');
    const autoJoinOrganizations = await this.organizationRepository
      .createQueryBuilder('organization')
      .select(columns)
      .where(
        `organization.is_deleted = false
        AND domain_name = :domainName
        AND NOT EXISTS (SELECT 1 FROM user_organization WHERE organization_id = organization.id AND user_id = :userId)`,
        { userId, domainName },
      )
      .groupBy('organization.id')
      .getRawMany();
    return invitedOrganizations.concat(autoJoinOrganizations);
  }

  public async invite(
    user: User,
    organizationId: number,
    organizationInvites: CreateOrganizationInviteDto[],
  ): Promise<boolean> {
    const userOrganization = _.find(user.userOrganizations, {
      organization: { id: organizationId } as any,
      // permissions: ['Admin'], // TODO: use new schema permission table
    }) as UserOrganization;
    if (!userOrganization) {
      throw new UnauthorizedException();
    }
    for (const organizationInviteDto of organizationInvites) {
      if (!organizationInviteDto.email) {
        continue;
      }
      let organizationInvite = new OrganizationInvite();
      organizationInvite.organization = new Organization();
      organizationInvite.organization.id = organizationId;
      organizationInvite.email = organizationInviteDto.email;
      organizationInvite.permissions = organizationInviteDto.permissions;
      organizationInvite.createdBy = user;
      try {
        organizationInvite = await this.organizationInviteRepository.save(
          organizationInvite,
        );
      } catch (error) {
        this.logger.log(error);
      }
      organizationInvite.organization = userOrganization.organization;
      // check if invited user is already a user
      const invitedUser = await this.userService.findByEmail(
        organizationInvite.email,
      );
      this.sendInviteEmail(user, organizationInvite, !!invitedUser);
    }
    return true;
  }

  public async allowAutoJoin(domainName: string): Promise<boolean> {
    const organizationDomainBlacklist = await this.organizationDomainBlacklistRepository.findOne(
      {
        where: { domainName: domainName.toLowerCase() },
      },
    );
    return !organizationDomainBlacklist;
  }

  public async join(user: User, organizationId: number): Promise<boolean> {
    // check if the user has been invited to the organization
    let organization;
    const organizationInvite = await this.organizationInviteRepository.findOne({
      where: { email: user.email, organization: { id: organizationId } },
    });
    if (organizationInvite) {
      organization = organizationInvite.organization;
    } else if (user.email) {
      // check if organization is auto join and check user email domain
      organization = await this.organizationRepository.findOne(organizationId);
      const domainName = user.email.replace(/.*@/, '');
      if (
        !organization ||
        !organization.isAutoJoin ||
        organization.domainName !== domainName
      ) {
        throw new UnauthorizedException(
          'User was not invited to join this organization.',
        );
      }
    }
    const userOrganization = new UserOrganization();
    userOrganization.user = user;
    userOrganization.organization = organization;
    userOrganization.organizationInvite = organizationInvite;
    userOrganization.permissions = organizationInvite
      ? organizationInvite.permissions
      : [];
    userOrganization.createdBy = user;
    await this.entityManager.save(userOrganization);
    return true;
  }

  public sendInviteEmail(
    user: User,
    organizationInvite: OrganizationInvite,
    isExistingUser: boolean,
  ) {
    const config = this.configService.get('email');
    const options = {
      to: organizationInvite.email,
      from: config.from,
      subject:
        config.invite && config.invite.subject
          ? config.invite.subject
          : 'Invite',
      template: 'organization-invite',
      context: {
        adminUser: user,
        organization: organizationInvite.organization,
        baseUrl: config.clientBaseUrl, // deprecated
        url: config.clientBaseUrl,
        inviteUrl: this.generateTokenUrl(
          organizationInvite.email,
          config.clientBaseUrl,
          isExistingUser,
        ),
        tokenExpiration: '30 days',
      },
    };
    this.mailerProvider.sendMail(options);
    this.logger.log(`Invite email sent to ${organizationInvite.email}`);
  }

  private generateTokenUrl(
    email: string,
    baseUrl: string,
    isExistingUser: boolean,
  ) {
    const expiresIn = '30 days';
    const path = isExistingUser ? '/join-team' : '/sign-up';
    const payload: JwtPayload = { userId: null, email }; // invites won't have a userId
    const token: JwtToken = this.authService.createToken(payload, expiresIn);
    // TODO: url encode email
    return `${baseUrl}${path}?email=${encodeURIComponent(email)}&token=${
      token.accessToken
    }`;
  }

  public async updateUserPermission(
    organizationId: number,
    userId: number,
    permissions: string[],
  ): Promise<boolean> {
    await this.entityManager.update(
      UserOrganization,
      {
        organization: { id: organizationId },
        user: { id: userId },
      },
      { permissions },
    );
    return true;
  }

  public async updateInvitePermission(
    organizationId: number,
    organizationInviteId: number,
    permissions: string[],
  ): Promise<boolean> {
    // Adding organizationId to query enforces that the correct
    // record is updated (i.e. prevent accidentally updating an
    // invite in another organization)
    await this.entityManager.update(
      OrganizationInvite,
      {
        id: organizationInviteId,
        organization: { id: organizationId },
      },
      { permissions },
    );
    return true;
  }

  public async deleteUser(
    organizationId: number,
    userId: number,
  ): Promise<boolean> {
    await this.entityManager.delete(UserOrganization, {
      organization: { id: organizationId },
      user: { id: userId },
    });
    return true;
  }

  public async deleteInvite(
    organizationId: number,
    organizationInviteId: number,
  ): Promise<boolean> {
    await this.entityManager.delete(OrganizationInvite, {
      organization: { id: organizationId },
      id: organizationInviteId,
    });
    return true;
  }
}
