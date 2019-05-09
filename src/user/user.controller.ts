import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import {
  InheritRoles,
  OwnerInterceptor,
  Roles,
  User,
  UserController as BaseUserController,
} from '@sierralabs/nest-identity';
import { ConfigService } from '@sierralabs/nest-utils';

import { UserOrganization } from '../entities/user-organization.entity';
import { OrganizationInviteDto } from '../organization/organization-invite.dto';
import { CreateOrganizationDto } from '../organization/organization.dto';
import { OrganizationService } from '../organization/organization.service';
import { UserService } from './user.service';

@Controller('users')
@InheritRoles()
export class UserController extends BaseUserController {
  constructor(
    protected readonly userService: UserService,
    protected readonly organizationService: OrganizationService,
    protected readonly configService: ConfigService,
  ) {
    super(userService, configService);
  }

  @Roles('$authenticated')
  @ApiOperation({ title: 'Get a list of organization invites' })
  @Get(':id([0-9]+)/invites')
  public async getInvites(
    @Param('id', new ParseIntPipe()) id: number,
    @Req() request,
  ): Promise<OrganizationInviteDto[]> {
    if (request.user.id !== id || !request.user.email) {
      throw new UnauthorizedException();
    }
    return this.organizationService.getUserInvites(id, request.user.email);
  }

  @Roles('$authenticated')
  @ApiOperation({
    title: 'Create organization, make user admin, and create a root folder',
  })
  @UseInterceptors(new OwnerInterceptor(['createdBy'], true))
  @Post(':id([0-9]+)/organizations')
  public async createOrganization(
    @Body() organizationDto: CreateOrganizationDto,
    @Req() request,
  ): Promise<UserOrganization> {
    const userId = request.user.id;
    return this.userService.createOrganization(userId, organizationDto);
  }
}
