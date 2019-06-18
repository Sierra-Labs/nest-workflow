import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Req,
  UseInterceptors,
  Post,
  Body,
  Put,
} from '@nestjs/common';
import { ApiOperation, ApiUseTags } from '@nestjs/swagger';
import { Roles, RolesType, OwnerInterceptor } from '@sierralabs/nest-identity';
import { ConfigService, RequiredPipe } from '@sierralabs/nest-utils';

import { WorkflowDto } from './workflow.dto';
import { WorkflowService } from './workflow.service';

@ApiUseTags('Workflows')
@Controller('workflows')
export class WorkflowController {
  constructor(
    protected readonly configService: ConfigService,
    protected readonly workflowService: WorkflowService,
  ) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Get a specific workflow version' })
  @Get('version/:workflowVersionId')
  findByVersionId(
    @Req() request,
    @Param('workflowVersionId', new RequiredPipe())
    workflowVersionId: string,
  ): Promise<WorkflowDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.workflowService.findByVersionId(
      activeOrganization.id,
      workflowVersionId,
    );
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Create a Workflow' })
  @UseInterceptors(new OwnerInterceptor(['createdBy', 'modifiedBy'], true))
  @Post()
  public async create(
    @Body() workflowDto: WorkflowDto,
    @Req() request,
  ): Promise<WorkflowDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    workflowDto.organizationId = activeOrganization.id;
    workflowDto.createdBy = request.user.id;
    workflowDto.modifiedBy = request.user.modifiedBy;
    return this.workflowService.create(workflowDto);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Update a Workflow' })
  @UseInterceptors(new OwnerInterceptor(['modifiedBy'], true))
  @Put(':id')
  public async update(
    @Param('id', new RequiredPipe()) id: string,
    @Body() workflowDto: WorkflowDto,
    @Req() request,
  ): Promise<WorkflowDto> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    workflowDto.organizationId = activeOrganization.id;
    workflowDto.id = id;
    workflowDto.modifiedBy = request.user.modifiedBy;
    return this.workflowService.update(workflowDto);
  }

  @Roles('Admin')
  @ApiOperation({ title: 'Delete a Workflow' })
  @Put(':id')
  public async delete(
    @Req() request,
    @Param('id', new RequiredPipe()) id: string,
  ): Promise<any> {
    const activeOrganization = request.user.activeOrganization;
    if (!activeOrganization) {
      throw new BadRequestException('no active organization specified.');
    }
    return this.workflowService.delete(id, request.user);
  }
}
