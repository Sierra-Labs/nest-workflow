import { EntityManager, Repository } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { NodeSchema } from '../entities/node-schema.entity';
import { FindNodeSchemaDto, NodeSchemaDto } from './node-schema.dto';

import { plainToClass } from 'class-transformer';
import { Attribute } from '../entities/attribute.entity';

@Injectable()
export class NodeSchemaService {
  constructor(
    protected readonly entityManager: EntityManager,
    @InjectRepository(NodeSchema)
    protected readonly nodeSchemaRepository: Repository<NodeSchema>,
    @InjectRepository(NodeSchemaVersion)
    protected readonly nodeSchemaVersionRepository: Repository<
      NodeSchemaVersion
    >,
    protected readonly configService: ConfigService,
  ) {}

  public async find(
    organizationId: number,
    order: any,
    limit: number = 100,
    offset: number = 0,
    search: string,
    includeDeleted?: boolean,
  ): Promise<[FindNodeSchemaDto[], number]> {
    const query = this.nodeSchemaRepository
      .createQueryBuilder('nodeSchema')
      .select([
        '"nodeSchema"."id" as "id"',
        '"publishedVersion"."id" as "publishedVersionId"',
        '"publishedVersion"."name" as "publishedName"',
        '"publishedVersion"."type" as "publishedType"',
        '"publishedVersion"."version" as "publishedVersion"',
        '"publishedVersion"."modified" as "publishedDate"',
        '"latestVersion"."id" as "latestVersionId"',
        '"latestVersion"."name" as "latestVersionName"',
        '"latestVersion"."type" as "latestVersionType"',
        '"latestVersion"."version" as "latestVersion"',
        '"latestVersion"."modified" as "latestVersionDate"',
      ])
      .leftJoin('nodeSchema.publishedVersion', 'publishedVersion')
      .leftJoin(
        subQuery => {
          return subQuery
            .from(subSubQuery => {
              return subSubQuery
                .from(NodeSchemaVersion, 'nodeSchemaVersion')
                .select([
                  'id',
                  'node_schema_id',
                  'name',
                  'type',
                  'version',
                  'modified',
                  `row_number() OVER ( PARTITION by "id" ORDER BY "version" DESC	) as row_num`,
                ]);
            }, 'version')
            .where('row_num = 1');
        },
        'latestVersion',
        '"latestVersion"."node_schema_id" = "nodeSchema"."id"',
      )
      .where(
        '"publishedVersion"."name" ILIKE :search OR "latestVersion"."name" ILIKE :search',
        { search },
      )
      .andWhere('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      });

    if (!includeDeleted) {
      query.andWhere('"nodeSchema".is_deleted = false');
    }
    const count = await query.getCount();
    const results = await query
      .orderBy(order)
      .limit(limit)
      .offset(offset)
      .getRawMany();
    return [results, count];
  }

  public async findById(
    organizationId: number,
    nodeSchemaId: string,
  ): Promise<NodeSchemaDto> {
    const nodeSchema = await this.nodeSchemaRepository
      .createQueryBuilder('nodeSchema')
      .leftJoinAndSelect('nodeSchema.publishedVersion', 'publishedVersion')
      .leftJoinAndSelect(
        'publishedVersion.attributes',
        'attribute',
        '"attribute".is_deleted = false',
      )
      .where('nodeSchema.organization_id = :organizationId', { organizationId })
      .andWhere('nodeSchema.id = :nodeSchemaId', { nodeSchemaId })
      .orderBy('attribute.position', 'ASC')
      .getOne();
    return this.mapToNodeSchemaDto(nodeSchema.publishedVersion);
  }

  public async findVersionById(
    organizationId: number,
    nodeSchemaVersionId: string,
  ): Promise<NodeSchemaDto> {
    const nodeSchemaVersion = await this.nodeSchemaVersionRepository
      .createQueryBuilder('nodeSchemaVersion')
      .leftJoinAndSelect('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attribute',
        '"attribute".is_deleted = false',
      )
      // Add the back references from relationships
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributeBackReferences',
        'attributeBackReferences',
        '"attributeBackReferences".is_deleted = false',
      )
      .leftJoinAndSelect(
        'attributeBackReferences.nodeSchemaVersion',
        'attributeBackReferenceNodeSchemaVersion',
      )
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"nodeSchemaVersion".id = :nodeSchemaVersionId', {
        nodeSchemaVersionId,
      })
      .orderBy('attribute.position', 'ASC')
      .getOne();
    return this.mapToNodeSchemaDto(nodeSchemaVersion);
  }

  public mapToNodeSchemaDto(
    nodeSchemaVersion: NodeSchemaVersion,
  ): NodeSchemaDto {
    const nodeSchemaDto: NodeSchemaDto = nodeSchemaVersion;
    nodeSchemaDto.versionId = nodeSchemaVersion.id;
    nodeSchemaDto.id = nodeSchemaVersion.nodeSchemaId;
    return nodeSchemaDto;
  }

  public async create(nodeSchemaDto: NodeSchemaDto): Promise<NodeSchemaDto> {
    let nodeSchema = new NodeSchema();
    nodeSchema.organizationId = nodeSchemaDto.organizationId;
    nodeSchema.createdBy = nodeSchemaDto.createdBy;
    nodeSchema.modifiedBy = nodeSchemaDto.modifiedBy;

    let nodeSchemaVersion = new NodeSchemaVersion();
    nodeSchemaVersion.version = 1; // first version
    nodeSchemaVersion.name = nodeSchemaDto.name;
    nodeSchemaVersion.type = nodeSchemaDto.type;
    nodeSchemaVersion.createdBy = nodeSchemaDto.createdBy;
    nodeSchemaVersion.modifiedBy = nodeSchemaDto.modifiedBy;

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      nodeSchema = await transactionalEntityManager.save(nodeSchema);
      nodeSchemaVersion.nodeSchemaId = nodeSchema.id;
      nodeSchemaVersion = await transactionalEntityManager.save(
        nodeSchemaVersion,
      );
      nodeSchemaVersion.nodeSchema = nodeSchema;
    });
    return this.findVersionById(
      nodeSchema.organizationId,
      nodeSchemaVersion.id,
    );
  }

  public async update(nodeSchemaDto: NodeSchemaDto): Promise<NodeSchemaDto> {
    // find the node schema being updated
    const nodeSchemaVersion = await this.nodeSchemaVersionRepository.findOne({
      where: {
        organizationId: nodeSchemaDto.organizationId,
        id: nodeSchemaDto.versionId,
      },
    });
    if (!nodeSchemaVersion) {
      throw new BadRequestException('Node Schema not found.');
    }
    if (nodeSchemaVersion.isPublished) {
      throw new BadRequestException(
        'The current Node Schema version is published. Please create a new version.',
      );
    }
    if (nodeSchemaDto.name) {
      nodeSchemaVersion.name = nodeSchemaDto.name;
    }
    if (nodeSchemaDto.type) {
      nodeSchemaVersion.type = nodeSchemaDto.type;
    }
    nodeSchemaVersion.modifiedBy = nodeSchemaDto.modifiedBy;
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(nodeSchemaVersion);
      if (nodeSchemaDto.attributes) {
        for (const attributeJson of nodeSchemaDto.attributes) {
          const attribute = plainToClass(Attribute, attributeJson);
          attribute.nodeSchemaVersionId = nodeSchemaVersion.id;
          attribute.referenceType = attribute.options.referenceType;
          attribute.referencedNodeSchemaVersionId =
            attribute.options.nodeSchemaVersionId;
          if (!attribute.id) {
            attribute.createdBy = nodeSchemaDto.modifiedBy;
          }
          attribute.modifiedBy = nodeSchemaDto.modifiedBy;
          await transactionalEntityManager.save(attribute);
        }
      }
      if (nodeSchemaDto.removedAttributes) {
        for (const attributeJson of nodeSchemaDto.removedAttributes) {
          if (!attributeJson.id) {
            continue; // skip attributes that don't exist in the database
          }
          const attribute = plainToClass(Attribute, attributeJson);
          attribute.isDeleted = true;
          attribute.nodeSchemaVersionId = nodeSchemaVersion.id;
          attribute.modifiedBy = nodeSchemaDto.modifiedBy;
          await transactionalEntityManager.save(attribute);
        }
      }
    });
    return this.findVersionById(
      nodeSchemaDto.organizationId,
      nodeSchemaDto.versionId,
    );
  }
}
