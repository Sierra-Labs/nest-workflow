import {
  BadRequestException,
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
} from '@nestjs/common';
import { ApiImplicitQuery, ApiOperation, ApiUseTags } from '@nestjs/swagger';
import { OwnerInterceptor, Roles, RolesType } from '@sierralabs/nest-identity';
import {
  ConfigService,
  ParseBooleanPipe,
  RequiredPipe,
} from '@sierralabs/nest-utils';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { NodeSchema } from '../entities/node-schema.entity';
import { Node } from '../entities/node.entity';
import { FindNodeSchemaDto, NodeSchemaDto } from './node-schema.dto';
import { NodeSchemaService } from './node-schema.service';
import { NodeService } from './node.service';

@ApiUseTags('Node Schemas')
@Controller('node-schemas')
export class NodeSchemaController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly nodeSchemaService: NodeSchemaService,
    protected readonly nodeService: NodeService,
  ) {}

  @Roles('Admin')
  @ApiOperation({ title: 'Get list of Node Schemas' })
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
  ): Promise<[FindNodeSchemaDto[], number]> {
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
      // 'id asc',
      // 'id desc',
      // 'name asc',
      // 'name desc',
      // 'type asc',
      // 'type desc',
      // 'created asc',
      // 'created desc',
      // 'modified asc',
      // 'modified desc',
    ];

    if (orderOptions.indexOf(order) === -1) {
      order = 'id asc';
    }
    const orderParts = order.split(' ');
    const orderConfig = {};
    orderConfig[orderParts[0]] = orderParts[1].toUpperCase();

    return this.nodeSchemaService.find(
      activeOrganization.id,
      orderConfig,
      limit,
      offset,
      '%' + (search || '') + '%',
      includeDeleted,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get nodes for a node schema' })
  @ApiImplicitQuery({ name: 'search', required: false })
  @ApiImplicitQuery({ name: 'page', required: false })
  @ApiImplicitQuery({ name: 'limit', required: false })
  @ApiImplicitQuery({ name: 'order', required: false })
  @ApiImplicitQuery({ name: 'includeDeleted', required: false })
  @Get(':nodeSchemaId/nodes')
  findNodesByNodeSchemaId(
    @Req() request,
    @Param('nodeSchemaId', new RequiredPipe()) nodeSchemaId: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('order') order?: string,
    @Query('search') search?: string,
    @Query('includeDeleted', new ParseBooleanPipe()) includeDeleted?: boolean,
  ): Promise<[Node[], number]> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    // TODO: Check Node Read Permissions

    const maxSize = this.configService.get('pagination.maxPageSize') || 200;
    const defaultSize =
      this.configService.get('pagination.defaultPageSize') || 100;
    limit = Math.min(maxSize, limit || defaultSize);
    const offset = (page || 0) * limit;

    const orderOptions = [
      // 'id asc',
      // 'id desc',
      // 'name asc',
      // 'name desc',
      // 'type asc',
      // 'type desc',
      // 'created asc',
      // 'created desc',
      // 'modified asc',
      // 'modified desc',
    ];

    if (orderOptions.indexOf(order) === -1) {
      order = 'id asc';
    }
    const orderParts = order.split(' ');
    const orderConfig = {};
    orderConfig[orderParts[0]] = orderParts[1].toUpperCase();

    return this.nodeService.find(
      nodeSchemaId,
      activeOrganization.id,
      orderConfig,
      limit,
      offset,
      '%' + (search || '') + '%',
      includeDeleted,
    );
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Get a specific node schema version' })
  @Get('version/:nodeSchemaVersionId')
  findVersionById(
    @Req() request,
    @Param('nodeSchemaVersionId', new RequiredPipe())
    nodeSchemaVersionId: string,
  ): Promise<NodeSchemaDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.nodeSchemaService.findVersionById(
      activeOrganization.id,
      nodeSchemaVersionId,
    );
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Get node schema and its latest schema version' })
  @Get(':nodeSchemaId')
  findById(
    @Req() request,
    @Param('nodeSchemaId', new RequiredPipe()) nodeSchemaId: string,
  ): Promise<NodeSchemaDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.nodeSchemaService.findById(activeOrganization.id, nodeSchemaId);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Create a Node Schema' })
  @UseInterceptors(new OwnerInterceptor(['createdBy', 'modifiedBy'], true))
  @Post()
  public async create(
    @Body() nodeSchemaDto: NodeSchemaDto,
    @Req() request,
  ): Promise<NodeSchemaDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    nodeSchemaDto.organizationId = activeOrganization.id;
    nodeSchemaDto.createdBy = request.user.id;
    nodeSchemaDto.modifiedBy = request.user.modifiedBy;
    return this.nodeSchemaService.create(nodeSchemaDto);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Update a Node Schema' })
  @UseInterceptors(new OwnerInterceptor(['modifiedBy'], true))
  @Put(':id')
  public async update(
    @Param('id', new RequiredPipe()) id: string,
    @Body() nodeSchemaDto: NodeSchemaDto,
    @Req() request,
  ): Promise<NodeSchemaDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    nodeSchemaDto.organizationId = activeOrganization.id;
    nodeSchemaDto.id = id;
    nodeSchemaDto.modifiedBy = request.user.modifiedBy;
    return this.nodeSchemaService.update(nodeSchemaDto);
  }
}
