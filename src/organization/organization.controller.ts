import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiImplicitParam,
  ApiOperation,
  ApiResponse,
  ApiUseTags,
} from '@nestjs/swagger';
import { OwnerInterceptor, Roles, RolesType } from '@sierralabs/nest-identity';
import { RequiredPipe } from '@sierralabs/nest-utils';

import { Organization } from '../entities/organization.entity';
import { CreateOrganizationInviteDto } from './organization-invite.dto';
import { OrganizationPermission } from './organization-permission.guard';
import {
  CreateOrganizationDto,
  UpdateUserOrganizationDto,
  UserOrganizationDto,
  GetOrganizationUserDto,
} from './organization.dto';
import { OrganizationService } from './organization.service';

@ApiBearerAuth()
@ApiUseTags('Organizations')
@Controller('organizations')
export class OrganizationController {
  constructor(protected readonly organizationService: OrganizationService) {}

  @Roles('Admin')
  @UseInterceptors(new OwnerInterceptor(['createdBy', 'modifiedBy'], true))
  @ApiOperation({ title: 'Create an Organization' })
  @ApiResponse({ status: 200, type: Organization, isArray: true })
  @Post()
  public async create(
    @Body(new RequiredPipe()) organizationDto: CreateOrganizationDto,
  ): Promise<Organization> {
    return this.organizationService.create(organizationDto);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Check if domain name is allowed for auto join' })
  @Get('verify/domain')
  public async allowAutoJoin(
    @Query('domainName') domainName: string,
  ): Promise<boolean> {
    return this.organizationService.allowAutoJoin(domainName);
  }

  @OrganizationPermission('Admin')
  @ApiOperation({ title: 'Invite a user to join the organization' })
  @Post(':id([0-9]+)/invite')
  public async invite(
    @Param('id', new ParseIntPipe()) organizationId: number,
    @Body(new RequiredPipe())
    organizationInvites: CreateOrganizationInviteDto[],
    @Req() request,
  ): Promise<boolean> {
    return this.organizationService.invite(
      request.user,
      organizationId,
      organizationInvites,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Join organization' })
  @Post(':id([0-9]+)/join')
  public async join(
    @Param('id', new ParseIntPipe()) organizationId: number,
    @Req() request,
  ): Promise<boolean> {
    return this.organizationService.join(request.user, organizationId);
  }

  @OrganizationPermission('Admin')
  @Get(':id([0-9]+)/users')
  @ApiOperation({
    title: 'Get users in an organization',
    description:
      'Get a list of users in the organizations along with their permissions',
  })
  @ApiResponse({ status: 200, type: UserOrganizationDto, isArray: true })
  public async getUsers(
    @Param('id', new ParseIntPipe()) organizationId: number,
  ): Promise<GetOrganizationUserDto> {
    return this.organizationService.getUsers(organizationId);
  }

  @OrganizationPermission('Admin')
  @Put(':organizationId([0-9]+)/users/:userId([0-9]+)')
  @ApiOperation({ title: 'Update user permission' })
  public async updateUserPermission(
    @Param('organizationId', new ParseIntPipe()) organizationId: number,
    @Param('userId', new ParseIntPipe()) userId: number,
    @Body() updateUserOrganizationDto: UpdateUserOrganizationDto,
  ): Promise<boolean> {
    return this.organizationService.updateUserPermission(
      organizationId,
      userId,
      updateUserOrganizationDto.permissions,
    );
  }

  @OrganizationPermission('Admin')
  @Put(':organizationId([0-9]+)/invite/:organizationInviteId([0-9]+)')
  @ApiOperation({ title: 'Update invite permission' })
  public async updateInvitePermission(
    @Param('organizationId', new ParseIntPipe()) organizationId: number,
    @Param('organizationInviteId', new ParseIntPipe())
    organizationInviteId: number,
    @Body() updateUserOrganizationDto: UpdateUserOrganizationDto,
  ): Promise<boolean> {
    return this.organizationService.updateInvitePermission(
      organizationId,
      organizationInviteId,
      updateUserOrganizationDto.permissions,
    );
  }

  @OrganizationPermission('Admin')
  @Delete(':organizationId([0-9]+)/users/:userId([0-9]+)')
  @ApiOperation({ title: 'Delete user from organization' })
  public async deleteUser(
    @Param('organizationId', new ParseIntPipe()) organizationId: number,
    @Param('userId', new ParseIntPipe()) userId: number,
  ): Promise<boolean> {
    return this.organizationService.deleteUser(organizationId, userId);
  }

  @OrganizationPermission('Admin')
  @Delete(':organizationId([0-9]+)/invite/:organizationInviteId([0-9]+)')
  @ApiOperation({ title: 'Delete invite' })
  public async deleteInvite(
    @Param('organizationId', new ParseIntPipe()) organizationId: number,
    @Param('organizationInviteId', new ParseIntPipe())
    organizationInviteId: number,
  ): Promise<boolean> {
    return this.organizationService.deleteInvite(
      organizationId,
      organizationInviteId,
    );
  }
}
