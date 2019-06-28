import {
  Controller,
  Get,
  Req,
  Query,
  BadRequestException,
  Param,
  UseInterceptors,
  Post,
  Body,
  Put,
  Delete,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUseTags,
  ApiOperation,
  ApiImplicitQuery,
} from '@nestjs/swagger';
import { NodeFindOptions } from './node.service';
import {
  ConfigService,
  ParseBooleanPipe,
  RequiredPipe,
} from '@sierralabs/nest-utils';
import { Roles, RolesType } from '@sierralabs/nest-identity';
import { NodeDataDto, NodeDataService } from './node-data.service';

@ApiUseTags('Node Data')
@Controller('node-data')
export class NodeDataController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly nodeDataService: NodeDataService,
  ) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Return a list of nodes for a specific node schema' })
  @Get(':nodeSchemaName')
  find(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('options') options?: NodeFindOptions | string,
  ): Promise<[NodeDataDto[], number]> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    if (options) {
      options = JSON.parse(options as string) as NodeFindOptions;
    } else {
      options = {} as NodeFindOptions;
    }
    const maxSize = this.configService.get('pagination.maxPageSize') || 200;
    const defaultSize =
      this.configService.get('pagination.defaultPageSize') || 100;
    options.limit = Math.min(maxSize, limit || defaultSize);
    options.page = page || 0;
    return this.nodeDataService.find(
      activeOrganization.id,
      nodeSchemaName,
      options,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get a specific node' })
  @Get(':nodeSchemaName/:nodeId')
  findById(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
  ): Promise<NodeDataDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Read Permissions and what attributes can be returned

    return this.nodeDataService.findById(
      activeOrganization.id,
      nodeSchemaName,
      nodeId,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Create a Node' })
  @Post(':nodeSchemaName')
  public async create(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Body() nodeDataDto: NodeDataDto,
  ): Promise<NodeDataDto> {
    if (!request.user.activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    return this.nodeDataService.create(
      nodeSchemaName,
      nodeDataDto,
      request.user,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Delete a node' })
  @Delete(':nodeSchemaName/:nodeId')
  public async delete(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
  ): Promise<boolean> {
    if (!request.user.activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    return this.nodeDataService.delete(nodeId, request.user);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Update a node' })
  @Put(':nodeSchemaName/:nodeId')
  public async update(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
    @Body() nodeDataDto: NodeDataDto,
  ): Promise<NodeDataDto> {
    if (!request.user.activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    nodeDataDto.nodeId = nodeId;
    return this.nodeDataService.update(nodeDataDto, request.user);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Bulk update nodes' })
  @Put()
  public async updateMultiple(
    @Req() request,
    @Body() nodeDataDtos: NodeDataDto[],
  ): Promise<NodeDataDto> {
    if (!request.user.activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    return this.nodeDataService.updateMultiple(nodeDataDtos, request.user);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({
    title: 'Creates a reference node and updates the source node attribute',
  })
  @Put(':nodeSchemaName/:nodeId/:referenceAttributeName')
  public async createReferenceNode(
    @Req() request,
    @Param('nodeSchemaName', new RequiredPipe()) nodeSchemaName: string,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
    @Param('referenceAttributeName', new RequiredPipe())
    referenceAttributeName: string,
    @Body() nodeDataDto: NodeDataDto,
  ): Promise<NodeDataDto> {
    if (!request.user.activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    return this.nodeDataService.createReferenceNode(
      nodeSchemaName,
      nodeId,
      referenceAttributeName,
      nodeDataDto,
      request.user,
    );
  }
}
