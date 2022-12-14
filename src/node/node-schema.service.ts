import { EntityManager, Repository } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { NodeSchema } from '../entities/node-schema.entity';
import { FindNodeSchemaDto, NodeSchemaDto } from './node-schema.dto';

import { plainToClass } from 'class-transformer';
import { Attribute, ReferenceType } from '../entities/attribute.entity';
import { User } from '../entities/user.entity';
import { AttributeType } from './attributes';
import { NodeSchemaPermission } from '../entities/node-schema-permission.entity';
import {
  NodeSchemaPermissionDto,
  UserNodeSchemaPermissionDto,
} from './node-schema-permission.dto';

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
    @InjectRepository(NodeSchemaPermission)
    protected readonly nodeSchemaPermissionRepository: Repository<
      NodeSchemaPermission
    >,
    protected readonly configService: ConfigService,
  ) {}

  public async find(
    organizationId: number,
    limit: number = 100,
    offset: number = 0,
    order: any,
    search: string,
    includeDeleted?: boolean,
  ): Promise<[FindNodeSchemaDto[], number]> {
    const query = this.nodeSchemaRepository
      .createQueryBuilder('nodeSchema')
      .select([
        '"nodeSchema"."id" as "id"',
        '"publishedVersion"."id" as "publishedVersionId"',
        '"publishedVersion"."name" as "publishedName"',
        '"publishedVersion"."label" as "publishedLabel"',
        '"publishedVersion"."type" as "publishedType"',
        '"publishedVersion"."version" as "publishedVersion"',
        '"publishedVersion"."modified" as "publishedDate"',
        '"latestVersion"."id" as "latestVersionId"',
        '"latestVersion"."name" as "latestVersionName"',
        '"latestVersion"."label" as "latestVersionLabel"',
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
                  'label',
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
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      });
    if (search) {
      query.andWhere(
        '"publishedVersion"."name" ILIKE :search OR "latestVersion"."name" ILIKE :search',
        { search: `%${search}%` },
      );
    }

    if (!includeDeleted) {
      query.andWhere('"nodeSchema".is_deleted = false');
    }
    const count = await query.getCount();
    query.limit(limit).offset(offset);
    if (order) {
      query.orderBy('"latestVersion"."name"');
    } else {
      query.orderBy('"latestVersionName"', 'ASC');
    }
    const results = await query.getRawMany();
    return [results, count];
  }

  public async findByType(
    organizationId: number,
    type: string,
  ): Promise<NodeSchemaDto[]> {
    const nodeSchemaVersions = await this.nodeSchemaVersionRepository
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
      .andWhere('"nodeSchemaVersion"."type" = :type', {
        type,
      })
      .orderBy('"attribute".position', 'ASC')
      .getMany();
    return nodeSchemaVersions.map(nodeSchemaVersion =>
      this.mapToNodeSchemaDto(nodeSchemaVersion),
    );
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
      // Add the back references from relationships
      .leftJoinAndSelect(
        'publishedVersion.attributeBackReferences',
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
      .andWhere('"nodeSchema".id = :nodeSchemaId', { nodeSchemaId })
      .orderBy('"attribute".position', 'ASC')
      .getOne();
    return this.mapToNodeSchemaDto(nodeSchema.publishedVersion);
  }

  public async findByName(
    organizationId: number,
    nodeSchemaName: string,
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
      .andWhere('"nodeSchemaVersion".name = :nodeSchemaName', {
        nodeSchemaName,
      })
      .orderBy('"attribute".position', 'ASC')
      .getOne();
    if (!nodeSchemaVersion) {
      return;
    }
    return this.mapToNodeSchemaDto(nodeSchemaVersion);
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
    if (!nodeSchemaVersion) {
      return;
    }
    return this.mapToNodeSchemaDto(nodeSchemaVersion);
  }

  public async getPermissions(): Promise<NodeSchemaPermissionDto[]> {
    const results = await this.nodeSchemaPermissionRepository
      .createQueryBuilder('nodeSchemaPermissions')
      .select([
        'nodeSchema.id as "nodeSchemaId"',
        'nodeSchemaVersion.name as "nodeSchemaName"',
        'nodeSchemaVersion.label as "nodeSchemaLabel"',
        'userNodeSchema.id as "userNodeSchemaId"',
        'userNodeSchemaVersion.name as "userNodeSchemaName"',
        'userNodeSchemaVersion.label as "userNodeSchemaLabel"',
        'nodeSchemaPermissions.permission as "permission"',
        'nodeSchemaPermissions.deleted as "deleted"',
      ])
      .innerJoin('nodeSchemaPermissions.nodeSchema', 'nodeSchema')
      .innerJoin('nodeSchema.versions', 'nodeSchemaVersion')
      .innerJoin('nodeSchemaPermissions.userNodeSchema', 'userNodeSchema')
      .innerJoin('userNodeSchema.versions', 'userNodeSchemaVersion')
      .where('"nodeSchemaPermissions"."deleted" = false')
      .orderBy('nodeSchema.id')
      .getRawMany();

    const nodeSchemaPermissions = [];
    let nodeSchemaPermissionDto: NodeSchemaPermissionDto;
    for (const row of results) {
      if (
        !nodeSchemaPermissionDto ||
        nodeSchemaPermissionDto.nodeSchemaId !== row.nodeSchemaId
      ) {
        nodeSchemaPermissionDto = {
          nodeSchemaId: row.nodeSchemaId,
          name: row.nodeSchemaName,
          label: row.nodeSchemaLabel,
          userNodeSchemaPermissions: [],
        };
        nodeSchemaPermissions.push(nodeSchemaPermissionDto);
      }
      const userNodeSchemaPermissionDto: UserNodeSchemaPermissionDto = {
        userNodeSchemaId: row.userNodeSchemaId,
        name: row.userNodeSchemaName,
        label: row.userNodeSchemaLabel,
        permission: row.permission,
        deleted: row.deleted,
      };
      nodeSchemaPermissionDto.userNodeSchemaPermissions.push(
        userNodeSchemaPermissionDto,
      );
    }
    return nodeSchemaPermissions;
  }

  public async upsertPermissions(
    nodeSchemaPermissions: NodeSchemaPermissionDto[],
    user: User,
  ): Promise<NodeSchemaPermissionDto[]> {
    const sqlParams = [];
    const params = [];
    let paramCount = 1;
    // nested for loop into the nodeSchemaPermissionDto[] per nodeSchemaId,
    // access userNodeSchemaPermissions, creating params to use in sql insert statement.
    for (const nodeSchemaPermission of nodeSchemaPermissions) {
      for (const userNodeSchemaPermission of nodeSchemaPermission.userNodeSchemaPermissions) {
        const rowParams = [
          nodeSchemaPermission.nodeSchemaId,
          userNodeSchemaPermission.userNodeSchemaId,
          userNodeSchemaPermission.permission,
          userNodeSchemaPermission.deleted || false,
          new Date(),
          user.id,
          new Date(),
          user.id,
        ];
        const rowSqlParams = [];
        // taking the row params and mapping them into Sql params [ "$1", "$2", "$3", .... ] joining them on ,
        rowParams.map(() => {
          rowSqlParams.push(`$${paramCount}`);
          paramCount++;
        });
        sqlParams.push(rowSqlParams.join(','));
        params.push(...rowParams);
      }
    }
    // insert statement that joins the sql params after each set of row params closing the rowParams1),(rowParams2,
    const sql = `INSERT INTO node_schema_permission (
        node_schema_id, user_node_schema_id, permission, deleted, modified, modified_by, created, created_by)
    VALUES (${sqlParams.join('),(')})
    ON CONFLICT (node_schema_id, user_node_schema_id)
      DO UPDATE
        SET permission = excluded.permission, modified = CURRENT_TIMESTAMP, modified_by = excluded.modified_by`;
    await this.nodeSchemaRepository.query(sql, params);
    return this.getPermissions();
  }

  public mapToNodeSchemaDto(
    nodeSchemaVersion: NodeSchemaVersion,
  ): NodeSchemaDto {
    const nodeSchemaDto: NodeSchemaDto = nodeSchemaVersion;
    // inverse attribute back references and add as a regular attribute
    for (const attributeBackReference of nodeSchemaVersion.attributeBackReferences) {
      const referenceAttribute = {
        id: attributeBackReference.id,
        nodeSchemaVersionId: attributeBackReference.nodeSchemaVersion.id,
        name: attributeBackReference.nodeSchemaVersion.name,
        label: attributeBackReference.nodeSchemaVersion.label,
        type: AttributeType.Reference,
        referenceType: this.inverseReferenceType(
          attributeBackReference.referenceType,
        ),
        isRequired: attributeBackReference.isRequired,
        position: nodeSchemaVersion.attributes.length, // add to end of attributes
        isBackReference: true,
        options: {
          template: '',
          nodeSchemaVersionId: attributeBackReference.nodeSchemaVersion.id,
          backReferenceName: attributeBackReference.name,
          backReferenceLabel: attributeBackReference.label,
          referenceType: this.inverseReferenceType(
            attributeBackReference.referenceType,
          ),
        },
      };
      nodeSchemaDto.attributes.push(referenceAttribute as Attribute);
    }
    nodeSchemaDto.versionId = nodeSchemaVersion.id;
    nodeSchemaDto.id = nodeSchemaVersion.nodeSchemaId;
    return nodeSchemaDto;
  }

  inverseReferenceType(referenceType: ReferenceType): ReferenceType {
    switch (referenceType) {
      case ReferenceType.OneToOne:
        return ReferenceType.OneToOne;
      case ReferenceType.OneToMany:
        return ReferenceType.ManyToOne;
      case ReferenceType.ManyToOne:
        return ReferenceType.OneToMany;
      case ReferenceType.ManyToMany:
        return ReferenceType.ManyToMany;
    }
  }

  public async create(nodeSchemaDto: NodeSchemaDto): Promise<NodeSchemaDto> {
    // if (
    //   nodeSchemaDto.versionId &&
    //   (await this.findVersionById(
    //     nodeSchemaDto.organizationId,
    //     nodeSchemaDto.versionId,
    //   ))
    // ) {
    //   throw new BadRequestException(
    //     'Node schema already exists with versionId',
    //   );
    // }
    let nodeSchema = new NodeSchema();
    nodeSchema.id = nodeSchemaDto.id;
    nodeSchema.organizationId = nodeSchemaDto.organizationId;
    nodeSchema.createdBy = nodeSchemaDto.createdBy;
    nodeSchema.modifiedBy = nodeSchemaDto.modifiedBy;

    let nodeSchemaVersion = new NodeSchemaVersion();
    nodeSchemaVersion.id = nodeSchemaDto.versionId;
    nodeSchemaVersion.version = 1; // first version
    nodeSchemaVersion.label = nodeSchemaDto.label;
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
      if (nodeSchemaDto.attributes) {
        await this.upsertAttributes(
          transactionalEntityManager,
          nodeSchemaDto.modifiedBy,
          nodeSchemaVersion.id,
          nodeSchemaDto.attributes,
        );
      }
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
    if (nodeSchemaDto.label) {
      nodeSchemaVersion.label = nodeSchemaDto.label;
    }
    if (nodeSchemaDto.type) {
      nodeSchemaVersion.type = nodeSchemaDto.type;
    }
    nodeSchemaVersion.modifiedBy = nodeSchemaDto.modifiedBy;
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(nodeSchemaVersion);
      if (nodeSchemaDto.attributes) {
        await this.upsertAttributes(
          transactionalEntityManager,
          nodeSchemaDto.modifiedBy,
          nodeSchemaVersion.id,
          nodeSchemaDto.attributes,
        );
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

  public async upsertAttributes(
    transactionalEntityManager: EntityManager,
    user: User,
    nodeSchemaVersionId: string,
    attributes: any[],
  ) {
    for (const attributeJson of attributes) {
      if (attributeJson.isBackReference) {
        // ignore back reference attributes since it was auto generated
        continue;
      }
      const attribute = plainToClass(Attribute, attributeJson);
      attribute.nodeSchemaVersionId = nodeSchemaVersionId;
      const referenceOptions = attribute.options;
      attribute.referenceType = referenceOptions.referenceType;
      attribute.referencedNodeSchemaVersionId =
        referenceOptions.nodeSchemaVersionId;
      if (!attribute.id || !attribute.createdBy) {
        // attribute.createdBy needed when importing
        attribute.createdBy = user;
      }
      attribute.modifiedBy = user;
      await transactionalEntityManager.save(attribute);
    }
  }
}
