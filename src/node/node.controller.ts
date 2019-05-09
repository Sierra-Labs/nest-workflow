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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiUseTags,
  ApiOperation,
  ApiImplicitQuery,
} from '@nestjs/swagger';
import { NodeService } from './node.service';
import {
  ConfigService,
  ParseBooleanPipe,
  RequiredPipe,
} from '@sierralabs/nest-utils';
import { Node } from '../entities/node.entity';
import { OwnerInterceptor, Roles, RolesType } from '@sierralabs/nest-identity';
import { NodeDto } from './node.dto';

@ApiUseTags('Nodes')
@Controller('nodes')
export class NodeController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly nodeService: NodeService,
  ) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get a specific node' })
  @Get(':nodeId')
  findById(
    @Req() request,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
  ): Promise<Node> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Read Permissions

    return this.nodeService.findById(activeOrganization.id, nodeId);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Create a Node' })
  @UseInterceptors(new OwnerInterceptor(['createdBy', 'modifiedBy'], true))
  @Post(':nodeSchemaVersionId')
  public async create(
    @Req() request,
    @Param('nodeSchemaVersionId', new RequiredPipe())
    nodeSchemaVersionId: string,
    @Body() nodeDto: NodeDto,
  ): Promise<Node> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    nodeDto.versionId = nodeSchemaVersionId;
    nodeDto.organizationId = activeOrganization.id;
    nodeDto.createdBy = request.user.id;
    nodeDto.modifiedBy = request.user.modifiedBy;
    return this.nodeService.create(nodeDto);
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Update a Node' })
  @UseInterceptors(new OwnerInterceptor(['modifiedBy'], true))
  @Put(':nodeId')
  public async update(
    @Req() request,
    @Param('nodeId', new RequiredPipe()) nodeId: string,
    @Body() nodeDto: NodeDto,
  ): Promise<Node> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }

    // TODO: Check Node Write Permissions

    nodeDto.organizationId = activeOrganization.id;
    nodeDto.id = nodeId;
    nodeDto.modifiedBy = request.user.modifiedBy;
    return this.nodeService.update(nodeDto);
  }
}
