import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseInterceptors,
  Delete,
} from '@nestjs/common';
import { ApiImplicitQuery, ApiOperation, ApiUseTags } from '@nestjs/swagger';
import { OwnerInterceptor, Roles, RolesType } from '@sierralabs/nest-identity';
import {
  ConfigService,
  ParseBooleanPipe,
  RequiredPipe,
} from '@sierralabs/nest-utils';

import { ViewTemplateVersion } from '../entities/view-template-version.entity';
import { ViewTemplateDto, FindViewTemplateDto } from './view.dto';
import { ViewService } from './view.service';
import { ViewTemplate } from '../entities/view-template.entity';

@ApiUseTags('Views')
@Controller('views')
export class ViewController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly viewService: ViewService,
  ) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get list of views' })
  @ApiImplicitQuery({ name: 'search', required: false })
  @ApiImplicitQuery({ name: 'page', required: false })
  @ApiImplicitQuery({ name: 'limit', required: false })
  @ApiImplicitQuery({ name: 'order', required: false })
  @ApiImplicitQuery({ name: 'includeDeleted', required: false })
  @Get()
  find(
    @Req() request,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('order') order?: string,
    @Query('search') search?: string,
    @Query('includeDeleted', new ParseBooleanPipe()) includeDeleted?: boolean,
  ): Promise<[FindViewTemplateDto[], number]> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    const maxSize = this.configService.get('pagination.maxPageSize') || 200;
    const defaultSize =
      this.configService.get('pagination.defaultPageSize') || 100;
    limit = Math.min(maxSize, limit || defaultSize);
    const offset = (page || 0) * limit;

    const orderOptions = [
      //   'id asc',
      //   'id desc',
      //   'name asc',
      //   'name desc',
      //   'created asc',
      //   'created desc',
      //   'modified asc',
      //   'modified desc',
    ];

    if (orderOptions.indexOf(order) === -1) {
      order = 'id asc';
    }
    const orderParts = order.split(' ');
    const orderConfig = {};
    orderConfig[orderParts[0]] = orderParts[1].toUpperCase();

    return this.viewService.find(
      activeOrganization.id,
      orderConfig,
      limit,
      offset,
      '%' + (search || '') + '%',
      includeDeleted,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get view template and its latest template version' })
  @Get(':viewId')
  findById(
    @Req() request,
    @Param('viewId', new RequiredPipe()) viewId: string,
  ): Promise<ViewTemplateDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.viewService.findById(activeOrganization.id, viewId);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get a specific view template version' })
  @Get('version/:versionId')
  findVersionById(
    @Req() request,
    @Param('versionId', new RequiredPipe()) viewTemplateVersionId: string,
  ): Promise<ViewTemplateDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.viewService.findVersionById(
      activeOrganization.id,
      viewTemplateVersionId,
    );
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Create a view template' })
  @UseInterceptors(new OwnerInterceptor(['createdBy', 'modifiedBy'], true))
  @Post()
  public async create(
    @Req() request,
    @Body() viewTemplateDto: ViewTemplateDto,
  ): Promise<ViewTemplateDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    viewTemplateDto.organizationId = activeOrganization.id;
    viewTemplateDto.createdBy = request.user.id;
    viewTemplateDto.modifiedBy = request.user.modifiedBy;
    return this.viewService.create(viewTemplateDto);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Update a view template' })
  @UseInterceptors(new OwnerInterceptor(['modifiedBy'], true))
  @Put(':id')
  public async update(
    @Req() request,
    @Param('id', new RequiredPipe()) id: string,
    @Body() viewTemplateDto: ViewTemplateDto,
  ): Promise<ViewTemplateDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    viewTemplateDto.organizationId = activeOrganization.id;
    viewTemplateDto.id = id;
    viewTemplateDto.modifiedBy = request.user.modifiedBy;
    return this.viewService.update(viewTemplateDto);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Delete a view template' })
  @Delete(':id')
  public async delete(
    @Req() request,
    @Param('id', new RequiredPipe()) id: string,
  ): Promise<boolean> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.viewService.delete(id, activeOrganization.id, request.user);
  }
}
