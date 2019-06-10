import * as _ from 'lodash';
import {
  EntityManager,
  Repository,
  SelectQueryBuilder,
  Brackets,
} from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { Node } from '../entities/node.entity';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { NodeDto, AttributeValueDto } from './node.dto';

export interface NodeAttributeWhereClause {
  [attributeName: string]: string;
}

/**
 * Sort order for find call
 * { firstName: 'ASC', id: 'DESC' }
 */
export interface NodeAttributeOrderClause {
  [attributeName: string]: 'ASC' | 'DESC';
}

export interface NodeFindOptions {
  nodeId?: string;
  search?: string; // search all attributes
  relations?: string[]; // TODO: join based on relationship fields
  includeReferences?: boolean;
  includeBackReferences?: boolean;
  page?: number;
  limit?: number;
  order?: NodeAttributeOrderClause;
  where?: NodeAttributeWhereClause | NodeAttributeWhereClause[];
}

@Injectable()
export class NodeService {
  constructor(
    protected readonly entityManager: EntityManager,
    @InjectRepository(Node)
    protected readonly nodeRepository: Repository<Node>,
    protected readonly configService: ConfigService,
    protected readonly attributeService: AttributeService,
    protected readonly sequenceAttributeService: SequenceAttributeService,
  ) {}

  public async find(
    nodeSchemaId: string,
    organizationId: number,
    limit: number = 100,
    offset: number = 0,
    options: NodeFindOptions,
    includeDeleted?: boolean,
  ): Promise<[Node[], number]> {
    // TODO: need to figure out how to handle node schema versions
    // -- the attributeIds for attribute values would be different from version to version
    // -- list views that have different node versions currently only accept most recent versions

    // TODO: Implement order, search

    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      .leftJoinAndSelect(
        'node.attributeValues',
        'attributeValue',
        '"attributeValue".is_deleted = false',
      )
      .leftJoinAndSelect(
        'attributeValue.attribute',
        'attribute',
        '"attribute".is_deleted = false',
      )
      .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .innerJoin(
        subQuery => {
          subQuery
            .from(Node, 'node')
            .select('"node"."id"')
            .leftJoin('node.attributeValues', 'attributeValue')
            .leftJoin('attributeValue.attribute', 'attribute')
            .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
            .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
            .where('"nodeSchemaVersion".node_schema_id = :nodeSchemaId', {
              nodeSchemaId,
            });
          if (options) {
            if (options.where) {
              if (options.where instanceof Array) {
                // TODO: implement OR logic
                // subQuery.andWhere(new Brackets(bracketQuery => {
                //   bracketQuery.orWhere()
                // }));
                // for (const where of options.where) {
                //   subQuery.andWhere('"attribute"."name" = :name', {});
                // }
              } else {
                this.addAttributeWhere(subQuery, options.where);
              }
            }
            if (options.search) {
              subQuery.andWhere('"attributeValue"."text_value" LIKE :search', {
                search: `%${options.search}%`,
              });
            }
          }
          // .andwhere('"attribute"."name" ');
          return subQuery;
        },
        'node_sub',
        'node_sub."id" = node."id"',
      )
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"nodeSchemaVersion".node_schema_id = :nodeSchemaId', {
        nodeSchemaId,
      });
    // TODO: implement order by
    // if (options && options.order) {
    //   const keys = Object.keys(query.orderBy);
    //   keys.forEach((key, index) => {
    //     const orderString = '"attribute"."name"';
    //     if (index === 0) {
    //       query.orderBy();
    //     }
    //   });
    // }
    return query.getManyAndCount();
  }

  public async addAttributeWhere(
    query: SelectQueryBuilder<any>,
    attributeWhereClause: NodeAttributeWhereClause,
  ) {
    const keys = Object.keys(attributeWhereClause);
    for (const key of keys) {
      if (key === 'referenceNodeId') {
        query.andWhere('"attributeValue"."reference_node_id" = :value', {
          value: attributeWhereClause.referenceNodeId,
        });
      } else {
        query.andWhere('"attribute"."name" = :key', { key });
        query.andWhere('"attributeValue"."text_value" = :value', {
          value: attributeWhereClause[key],
        });
      }
    }
  }

  public async findById(organizationId: number, nodeId: string): Promise<Node> {
    return (
      this.nodeRepository
        .createQueryBuilder('node')
        .innerJoinAndSelect('node.nodeSchemaVersion', 'nodeSchemaVersion')
        .leftJoinAndSelect(
          'nodeSchemaVersion.attributes',
          'attributes',
          '"attributes".is_deleted = false',
        )
        .leftJoinAndSelect(
          'node.attributeValues',
          'attributeValue',
          '"attributeValue".is_deleted = false',
        )
        .leftJoinAndSelect(
          'attributeValue.attribute',
          'attribute',
          '"attribute".is_deleted = false',
        )
        .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
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
        .leftJoinAndSelect(
          'attributeBackReferenceNodeSchemaVersion.nodes',
          'backReferenceNode',
          `"backReferenceNode".is_deleted = false AND
            EXISTS (SELECT 1 FROM "attribute_value" WHERE reference_node_id = :nodeId AND node_id = "backReferenceNode".id)`,
          { nodeId },
        )
        .leftJoinAndSelect(
          'backReferenceNode.attributeValues',
          'backReferenceNodeAttributeValue',
          '"backReferenceNodeAttributeValue".is_deleted = false',
        )
        .leftJoinAndSelect(
          'backReferenceNodeAttributeValue.attribute',
          'backReferenceNodeAttribute',
          '"backReferenceNodeAttribute".is_deleted = false',
        )
        .where('"nodeSchema".organization_id = :organizationId', {
          organizationId,
        })
        .andWhere('"node".id = :nodeId', { nodeId })
        .getOne()
    );
  }

  public async create(nodeDto: NodeDto): Promise<Node> {
    const nodeSchemaVersion = await this.entityManager
      .createQueryBuilder(NodeSchemaVersion, 'nodeSchemaVersion')
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attributes',
        '"attributes".is_deleted = false',
      )
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId: nodeDto.organizationId,
      })
      .andWhere('"nodeSchemaVersion".id = :nodeSchemaVersionId', {
        nodeSchemaVersionId: nodeDto.versionId,
      })
      .getOne();
    if (!nodeSchemaVersion) {
      throw new BadRequestException('Node Schema not found.');
    }
    let node = new Node();
    node.nodeSchemaVersionId = nodeDto.versionId;
    node.createdBy = nodeDto.createdBy;
    node.modifiedBy = nodeDto.modifiedBy;

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      node = await transactionalEntityManager.save(node);
      // assign the nodeSchemaVersion for use when processing attribute values
      node.nodeSchemaVersion = nodeSchemaVersion;
      await this.upsertAttributeValues(
        transactionalEntityManager,
        node,
        nodeDto.attributeValues || [],
      );
      await this.upsertBackReferences(
        transactionalEntityManager,
        nodeDto,
        node,
        nodeDto.attributeValues || [],
      );
    });
    return this.findById(nodeDto.organizationId, node.id);
  }

  public async update(nodeDto: NodeDto): Promise<Node> {
    const node = await this.findById(nodeDto.organizationId, nodeDto.id);
    if (!node) {
      throw new BadRequestException('Node not found.');
    }
    // updated modified by
    node.modifiedBy = nodeDto.modifiedBy;

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(node);
      await this.upsertAttributeValues(
        transactionalEntityManager,
        node,
        nodeDto.attributeValues || [],
      );
      await this.upsertBackReferences(
        transactionalEntityManager,
        nodeDto,
        node,
        nodeDto.attributeValues || [],
      );
    });
    return this.findById(nodeDto.organizationId, node.id);
  }

  protected async upsertAttributeValues(
    transactionalEntityManager: EntityManager,
    node: Node,
    attributeValueDtos: AttributeValueDto[],
  ) {
    // Loop through all attributes and see if there's needed processing
    // (example: Sequence attributes need to be auto generated)
    for (const attribute of node.nodeSchemaVersion.attributes) {
      switch (attribute.type) {
        case 'sequence':
          await this.sequenceAttributeService.upsertAttributeValue(
            transactionalEntityManager,
            node,
            // sequence generates attribute values so pass in the attribute id only
            { attributeId: attribute.id },
          );
          break;
        default:
          // some attributes can have one or more attribute values (so filter)
          const filteredAttributeValueDtos = _.filter(attributeValueDtos, {
            attributeId: attribute.id,
          });
          if (
            filteredAttributeValueDtos.length === 0 &&
            attribute.options.default
          ) {
            // Default attribute value available so use it
            const attributeValueDto: AttributeValueDto = {
              attributeId: attribute.id,
            };
            // TODO: account for different types of default values for
            // each attribute type
            if (attribute.type === 'number') {
              attributeValueDto.numberValue = attribute.options.default;
            } else {
              attributeValueDto.textValue = attribute.options.default;
            }
            await this.attributeService.upsertAttributeValue(
              transactionalEntityManager,
              node,
              attributeValueDto,
            );
          } else {
            for (const attributeValueDto of filteredAttributeValueDtos) {
              // if (attribute.type === 'reference') {
              //   console.log(
              //     'upsertAttributeValues() attributeValueDto.referenceNode',
              //     attributeValueDto.referenceId,
              //   );
              // }
              // Some attribute types have their own upserts
              await this.attributeService.upsertAttributeValue(
                transactionalEntityManager,
                node,
                attributeValueDto,
              );
            }
          }
      }
    }
  }

  protected async upsertBackReferences(
    transactionalEntityManager: EntityManager,
    nodeDto: NodeDto,
    node: Node,
    attributeValueDtos: AttributeValueDto[],
  ) {
    if (!node.nodeSchemaVersion.attributeBackReferences) {
      return;
    }
    // console.log(
    //   'node.nodeSchemaVersion.attributeBackReferences',
    //   node.nodeSchemaVersion.attributeBackReferences,
    // );
    for (const attribute of node.nodeSchemaVersion.attributeBackReferences) {
      // console.log('processing back references attribute', attribute);
      const filteredAttributeValueDtos = _.filter(attributeValueDtos, {
        attributeId: attribute.id,
      });
      // console.log(
      //   'found back references attribute value: ',
      //   filteredAttributeValueDtos,
      // );
      for (const attributeValueDto of filteredAttributeValueDtos) {
        // console.log(
        //   'attributeValueDto.referenceNode',
        //   attributeValueDto.referenceNode,
        // );
        attributeValueDto.referenceNode.organizationId = nodeDto.organizationId;
        attributeValueDto.referenceNode.versionId =
          attributeValueDto.referenceNode.nodeSchemaVersionId;
        attributeValueDto.referenceNode.modifiedBy = nodeDto.modifiedBy;
        if (attributeValueDto.referenceNode.id) {
          await this.update(attributeValueDto.referenceNode);
        } else {
          attributeValueDto.referenceNode.createdBy = nodeDto.modifiedBy;
          await this.create(attributeValueDto.referenceNode);
        }
      }
    }
  }
}
