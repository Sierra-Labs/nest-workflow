import { Injectable, BadRequestException } from '@nestjs/common';
import { User } from '../entities';
import { WorkflowDto } from './workflow.dto';
import { Workflow } from '../entities/workflow.entity';
import { WorkflowVersion } from '../entities/workflow-version.entity';
import { EntityManager, Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class WorkflowService {
  constructor(
    protected readonly entityManager: EntityManager,
    @InjectRepository(Workflow)
    protected readonly workflowRepository: Repository<Workflow>,
    @InjectRepository(WorkflowVersion)
    protected readonly workflowVersionRepository: Repository<WorkflowVersion>,
  ) {}
  // public async find(
  //   organizationId: number,
  //   order: any,
  //   limit: number = 100,
  //   offset: number = 0,
  //   search: string,
  //   includeDeleted?: boolean,
  // ): Promise<[FindWorkflowDto[], number]> {}

  // public async findById(
  //   organizationId: number,
  //   workflowId: string,
  // ): Promise<WorkflowDto> {}

  // public async findByName(
  //   organizationId: number,
  //   workflowName: string,
  // ): Promise<WorkflowDto> {}

  public async findByVersionId(
    organizationId: number,
    workflowVersionId: string,
  ): Promise<WorkflowDto> {
    const workflowVersion = await this.workflowVersionRepository
      .createQueryBuilder('workflowVersion')
      .leftJoinAndSelect('workflowVersion.workflow', 'workflow')
      .where('"workflow".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"workflowVersion".id = :workflowVersionId', {
        workflowVersionId,
      })
      .orderBy('"workflowVersion".position', 'ASC')
      .getOne();
    return this.mapToWorkflowDto(workflowVersion);
  }

  public async findByNodeSchemaVersionId(
    organizationId: number,
    nodeSchemaVersionId: string,
  ): Promise<WorkflowDto[]> {
    const workflowVersions = await this.workflowVersionRepository
      .createQueryBuilder('workflowVersion')
      .leftJoinAndSelect('workflowVersion.workflow', 'workflow')
      .where('"workflow".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere(
        '"workflowVersion"."node_schema_version_id" = :nodeSchemaVersionId',
        {
          nodeSchemaVersionId,
        },
      )
      .orderBy('"workflowVersion".position', 'ASC')
      .getMany();
    const workflowDtos = [];
    for (const workflowVersion of workflowVersions) {
      workflowDtos.push(this.mapToWorkflowDto(workflowVersion));
    }
    return workflowDtos;
  }

  public mapToWorkflowDto(workflowVersion: WorkflowVersion): WorkflowDto {
    const workflowDto: WorkflowDto = workflowVersion;
    workflowDto.versionId = workflowVersion.id;
    workflowDto.id = workflowVersion.workflowId;
    return workflowDto;
  }

  public async create(workflowDto: WorkflowDto): Promise<WorkflowDto> {
    if (
      workflowDto.versionId &&
      (await this.findByVersionId(
        workflowDto.organizationId,
        workflowDto.versionId,
      ))
    ) {
      throw new BadRequestException(
        'Node schema already exists with versionId',
      );
    }
    let workflow = new Workflow();
    workflow.id = workflowDto.id;
    workflow.organizationId = workflowDto.organizationId;
    workflow.createdBy = workflowDto.createdBy;
    workflow.modifiedBy = workflowDto.modifiedBy;

    let workflowVersion = new WorkflowVersion();
    workflowVersion.id = workflowDto.versionId;
    workflowVersion.version = 1; // first version
    workflowVersion.label = workflowDto.label;
    workflowVersion.name = workflowDto.name;
    workflowVersion.nodeSchemaVersionId = workflowDto.nodeSchemaVersionId;
    workflowVersion.trigger = workflowDto.trigger;
    workflowVersion.position = workflowDto.position;
    workflowVersion.config = workflowDto.config;
    workflowVersion.sampleData = workflowDto.sampleData;
    workflowVersion.createdBy = workflowDto.createdBy;
    workflowVersion.modifiedBy = workflowDto.modifiedBy;

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      workflow = await transactionalEntityManager.save(workflow);
      workflowVersion.workflowId = workflow.id;
      workflowVersion = await transactionalEntityManager.save(workflowVersion);
      workflowVersion.workflow = workflow;
    });
    return this.findByVersionId(workflow.organizationId, workflowVersion.id);
  }

  public async update(workflowDto: WorkflowDto): Promise<WorkflowDto> {
    // find the node schema being updated
    const workflowVersion = await this.workflowVersionRepository.findOne({
      where: {
        organizationId: workflowDto.organizationId,
        id: workflowDto.versionId,
      },
    });
    if (!workflowVersion) {
      throw new BadRequestException('Workflow not found.');
    }
    if (workflowVersion.isPublished) {
      throw new BadRequestException(
        'The current Workflow version is published. Please create a new version.',
      );
    }
    if (workflowDto.name) {
      workflowVersion.name = workflowDto.name;
    }
    if (workflowDto.label) {
      workflowVersion.label = workflowDto.label;
    }
    if (workflowDto.trigger) {
      workflowVersion.trigger = workflowDto.trigger;
    }
    if (workflowDto.config) {
      workflowVersion.config = workflowDto.config;
    }
    if (workflowDto.sampleData) {
      workflowVersion.sampleData = workflowDto.sampleData;
    }
    workflowVersion.position = workflowDto.position;
    workflowVersion.modifiedBy = workflowDto.modifiedBy;
    await this.workflowVersionRepository.save(workflowVersion);
    return this.findByVersionId(
      workflowDto.organizationId,
      workflowDto.versionId,
    );
  }

  public async delete(workflowId: string, user: User) {
    const workflow = await this.workflowRepository.findOne({
      where: {
        id: workflowId,
        organizationId: user.activeOrganization.id,
      },
    });
    if (!workflow) {
      throw new BadRequestException('Workflow not found.');
    }
    const updateWorkflow = new Workflow();
    updateWorkflow.id = workflowId;
    updateWorkflow.isDeleted = true;
    updateWorkflow.modifiedBy = user;
    updateWorkflow.modifiedBy = user; // needed for attribute values
    return this.workflowRepository.save(updateWorkflow);
  }

  // public async applyReadWorkflows(
  //   nodeSchema: NodeSchema,
  //   nodeDataDto: NodeDataDto,
  // ) {}
}
