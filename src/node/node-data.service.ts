import * as _ from 'lodash';
import {
  Brackets,
  EntityManager,
  Repository,
  SelectQueryBuilder,
} from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { User } from '../entities';
import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { Node } from '../entities/node.entity';
import { AttributeType } from './attributes';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { AttributeValueDto, NodeDto } from './node.dto';
import {
  NodeAttributeWhereClause,
  NodeFindOptions,
  NodeService,
} from './node.service';

export enum ReferenceType {
  OneToOne = 'one-to-one',
  OneToMany = 'one-to-many',
  ManyToOne = 'many-to-one',
  ManyToMany = 'many-to-many',
}

export interface NodeDataDto {
  nodeId?: string;
  [attributeName: string]: any;
}

@Injectable()
export class NodeDataService {
  constructor(
    protected readonly entityManager: EntityManager,
    @InjectRepository(Node)
    protected readonly nodeRepository: Repository<Node>,
    protected readonly nodeService: NodeService,
    protected readonly configService: ConfigService,
    protected readonly attributeService: AttributeService,
    protected readonly sequenceAttributeService: SequenceAttributeService,
  ) {}

  public async find(
    organizationId: number,
    nodeSchemaName: string,
    options?: NodeFindOptions,
  ): Promise<[NodeDataDto[], number]> {
    if (!options) {
      options = {};
    }
    nodeSchemaName = _.camelCase(nodeSchemaName); // convert node schema name to camel case
    const limit = options.limit || 100;
    const offset = (options.page || 0) * limit;
    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      // get node attributes
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
      // for attributes with reference nodes get the reference nodes
      .leftJoinAndSelect('attributeValue.referenceNode', 'referenceNode')
      .leftJoinAndSelect(
        'referenceNode.attributeValues',
        'referenceNodeAttributeValue',
        '"referenceNodeAttributeValue".is_deleted = false',
      )
      .leftJoinAndSelect(
        'referenceNodeAttributeValue.attribute',
        'referenceNodeAttribute',
        '"referenceNodeAttribute".is_deleted = false',
      )
      // Get the node schema
      .innerJoinAndSelect('node.nodeSchemaVersion', 'nodeSchemaVersion')
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
        EXISTS (SELECT 1 FROM "attribute_value" WHERE reference_node_id = node."id" AND node_id = "backReferenceNode".id)`,
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
      );

    if (options.nodeId) {
      query.where('"node"."id" = :nodeId', { nodeId: options.nodeId });
      query.andWhere('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      });
    } else {
      query.innerJoin(
        subQuery => {
          subQuery
            .from(Node, 'node')
            .select('"node"."id"')
            .leftJoin('node.attributeValues', 'attributeValue')
            .leftJoin('attributeValue.attribute', 'attribute')
            .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
            .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
            .where('"nodeSchemaVersion".name = :nodeSchemaName', {
              nodeSchemaName,
            });
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
          // .andwhere('"attribute"."name" ');
          return subQuery;
        },
        'node_sub',
        'node_sub."id" = node."id"',
      );
      query.where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      });
    }

    query.andWhere('"nodeSchemaVersion".name = :nodeSchemaName', {
      nodeSchemaName,
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
    // console.log('query: ', query.getSql());
    const results = await query.getManyAndCount();
    const totalCount = results[1];
    const normalizedNodes = [];
    for (const node of results[0]) {
      normalizedNodes.push(this.normalizeNodeAttributes(node));
    }
    return [normalizedNodes, totalCount];
  }

  public async addAttributeWhere(
    query: SelectQueryBuilder<any>,
    attributeWhereClause: NodeAttributeWhereClause,
  ) {
    const keys = Object.keys(attributeWhereClause);
    for (const key of keys) {
      if (key === 'referenceNodeId') {
        // filter to get forward reference relationships
        query.andWhere('"attributeValue"."reference_node_id" = :value', {
          value: attributeWhereClause.referenceNodeId,
        });
      } else if (key === 'backReferenceNodeId') {
        // filter to get back reference relationships
        query
          .innerJoin(
            'nodeSchemaVersion.attributeBackReferences',
            'attributeBackReferences',
            '"attributeBackReferences".is_deleted = false',
          )
          .innerJoin(
            'attributeBackReferences.nodeSchemaVersion',
            'attributeBackReferenceNodeSchemaVersion',
          )
          .innerJoin(
            'attributeBackReferenceNodeSchemaVersion.nodes',
            'backReferenceNode',
            `"backReferenceNode".is_deleted = false AND "backReferenceNode"."id" = :nodeId AND
        EXISTS (SELECT 1 FROM "attribute_value" WHERE reference_node_id = "node"."id" AND node_id = "backReferenceNode"."id")`,
            { nodeId: attributeWhereClause.backReferenceNodeId },
          );
      } else {
        query.andWhere('"attribute"."name" = :key', { key });
        query.andWhere('"attributeValue"."text_value" = :value', {
          value: attributeWhereClause[key],
        });
      }
    }
  }

  public async findById(
    organizationId: number,
    nodeSchemaName: string,
    nodeId: string,
  ): Promise<NodeDataDto> {
    const results = await this.find(organizationId, nodeSchemaName, { nodeId });
    return results[0][0];
  }

  public normalizeNodeAttributes(node: Node): NodeDataDto {
    const nodeDataDto = { nodeId: node.id } as NodeDataDto;
    for (const attributeValue of node.attributeValues) {
      const fieldName = this.getAttributeValueFieldNameByType(
        attributeValue.attribute.type,
      );
      if (attributeValue.attribute.type === AttributeType.Reference) {
        if (!attributeValue.referenceNode) {
          continue; // skip if no reference node exists
        }
        const noramlizedReferenceNode = this.normalizeNodeAttributes(
          attributeValue.referenceNode,
        );
        const attributeOptions = attributeValue.attribute.options;
        if (
          attributeOptions.referenceType === ReferenceType.ManyToMany ||
          attributeOptions.referenceType === ReferenceType.OneToMany
        ) {
          if (!nodeDataDto[attributeValue.attribute.name]) {
            nodeDataDto[attributeValue.attribute.name] = [];
          }
          nodeDataDto[attributeValue.attribute.name].push(
            noramlizedReferenceNode,
          );
        } else {
          nodeDataDto[attributeValue.attribute.name] = noramlizedReferenceNode;
        }
      } else {
        nodeDataDto[attributeValue.attribute.name] = attributeValue[fieldName];
      }
    }
    // attribute back references
    if (
      node.nodeSchemaVersion &&
      node.nodeSchemaVersion.attributeBackReferences
    ) {
      for (const attributeBackReference of node.nodeSchemaVersion
        .attributeBackReferences) {
        nodeDataDto[attributeBackReference.nodeSchemaVersion.name] = [];
        if (!attributeBackReference.nodeSchemaVersion.nodes) {
          continue;
        }
        for (const referenceNode of attributeBackReference.nodeSchemaVersion
          .nodes) {
          const referenceNodeDataDto = this.normalizeNodeAttributes(
            referenceNode,
          );
          nodeDataDto[attributeBackReference.nodeSchemaVersion.name].push(
            referenceNodeDataDto,
          );
        }
      }
    }
    return nodeDataDto;
  }

  public getAttributeValueFieldNameByType(type: AttributeType): string {
    switch (type) {
      case AttributeType.DateTime:
        // TODO: handle date/time values
        return 'dateValue';
      case AttributeType.File:
      case AttributeType.List:
        return 'jsonValue';
      case AttributeType.Number:
        return 'numberValue';
      case AttributeType.Reference:
        return 'referenceNode';
      case AttributeType.Enumeration:
      case AttributeType.Sequence:
      case AttributeType.Text:
      default:
        return 'textValue';
    }
  }

  public async create(
    nodeSchemaName: string,
    nodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    const nodeSchemaVersion = await this.entityManager
      .createQueryBuilder(NodeSchemaVersion, 'nodeSchemaVersion')
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attributes',
        '"attributes".is_deleted = false',
      )
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId: user.activeOrganization.id,
      })
      .andWhere('"nodeSchemaVersion".name = :nodeSchemaName', {
        nodeSchemaName,
      })
      .getOne();
    if (!nodeSchemaVersion) {
      throw new BadRequestException('Node Schema not found.');
    }
    let node = new Node();
    node.nodeSchemaVersionId = nodeSchemaVersion.id;
    node.createdBy = user;
    node.modifiedBy = user;
    node.attributeValues = [];

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      node = await transactionalEntityManager.save(node);
      // assign the nodeSchemaVersion for use when processing attribute values
      node.nodeSchemaVersion = nodeSchemaVersion;
      await this.upsertAttributeValues(
        transactionalEntityManager,
        node,
        nodeDataDto,
      );
    });
    return this.findById(user.activeOrganization.id, nodeSchemaName, node.id);
  }

  public async update(
    nodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    const node = await this.nodeService.findById(
      user.activeOrganization.id,
      nodeDataDto.nodeId,
    );
    if (!node) {
      throw new BadRequestException('Node not found.');
    }
    node.modifiedBy = user;
    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(node);
      await this.upsertAttributeValues(
        transactionalEntityManager,
        node,
        nodeDataDto,
      );
    });
    return this.findById(
      user.activeOrganization.id,
      node.nodeSchemaVersion.name,
      node.id,
    );
  }

  protected async upsertAttributeValues(
    transactionalEntityManager: EntityManager,
    node: Node,
    nodeDataDto: NodeDataDto,
  ) {
    // Loop through all attributes and see if there's needed processing
    // (example: Sequence attributes need to be auto generated)
    for (const attribute of node.nodeSchemaVersion.attributes) {
      const attributeValues = _.filter(node.attributeValues, {
        attributeId: attribute.id,
      });
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
          const value = nodeDataDto[attribute.name];
          const attributeValueDto: AttributeValueDto = {
            attributeId: attribute.id,
          };
          const fieldName = this.getAttributeValueFieldNameByType(
            attribute.type,
          );
          if (!value && attributeValues.length > 0) {
            continue; // no data for attribute
          } else if (
            !value &&
            attributeValues.length === 0 &&
            attribute.options.default
          ) {
            // Default attribute value available so use it
            attributeValueDto[fieldName] = attribute.options.default;
          } else if (value || value == null) {
            if (attributeValues.length > 0) {
              attributeValueDto.id = attributeValues[0].id;
            }
            // null values are treated as intentitional clearing of attribute value
            if (attribute.type === AttributeType.Reference) {
              attributeValueDto.referenceNodeId =
                value && value.nodeId ? value.nodeId : null;
            } else {
              attributeValueDto[fieldName] = value;
            }
          }
          await this.attributeService.upsertAttributeValue(
            transactionalEntityManager,
            node,
            attributeValueDto,
          );
      }
    }
  }
}
