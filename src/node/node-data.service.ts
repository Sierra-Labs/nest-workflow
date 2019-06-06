import * as _ from 'lodash';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { User, NodeSchema, AttributeValue } from '../entities';
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
import { NodeSchemaService } from './node-schema.service';
import { NodeSchemaDto } from './node-schema.dto';

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
    protected readonly nodeSchemaService: NodeSchemaService,
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
    // need to get the nodeSchema to access meta data when building the query
    const nodeSchemaDto = await this.nodeSchemaService.findByName(
      organizationId,
      nodeSchemaName,
    );
    const limit = options.limit || 100;
    const offset = (options.page || 0) * limit;
    // first get the node and attribute values in the correct order
    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      .select('node.id') // only get node id
      .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
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
      );
    this.addFindWhere(query, organizationId, nodeSchemaDto, options);

    // console.log('node attribute value query: ', query.getSql());
    const results = await query.getManyAndCount();
    const nodes = results[0];
    const totalCount = results[1];

    // next get the the reference attribute node values
    // (doing this in a second query so that results returned are not compounded)
    let nodeReferences = [];
    if (options.includeReferences) {
      nodeReferences = await this.findNodeReferences(
        organizationId,
        nodeSchemaDto,
        options,
      );
    }

    // next get the the back reference attribute node values
    // (doing this in a third query so that results returned are not compounded)
    let nodeBackReferences = [];
    if (options.includeBackReferences) {
      nodeBackReferences = await this.findNodeBackReferences(
        organizationId,
        nodeSchemaDto,
        options,
      );
    }

    const normalizedNodes = [];
    for (const node of nodes) {
      // normalize the nodes and merge the reference nodes and back reference nodes
      const nodeId = node.id;
      const nodeDataDto = this.normalizeNodeAttributes(node);
      const nodeWithReference = _.find(nodeReferences, { nodeId });
      const nodeWithBackReference = _.find(nodeBackReferences, { nodeId });
      if (nodeWithReference) {
        Object.assign(nodeDataDto, nodeWithReference);
      }
      if (nodeWithBackReference) {
        Object.assign(nodeDataDto, nodeWithBackReference);
      }
      normalizedNodes.push(nodeDataDto);
    }
    return [normalizedNodes, totalCount];
  }

  protected async findNodeReferences(
    organizationId: number,
    nodeSchemaDto: NodeSchemaDto,
    options: NodeFindOptions,
  ): Promise<NodeDataDto[]> {
    const limit = options.limit || 100;
    const offset = (options.page || 0) * limit;
    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      .select('node.id') // only get node id
      .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .leftJoinAndSelect(
        // make sure to consistently use leftJoin to match node results from find()
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
      .innerJoinAndSelect('attributeValue.referenceNode', 'referenceNode')
      .innerJoinAndSelect(
        'referenceNode.attributeValues',
        'referenceNodeAttributeValue',
        '"referenceNodeAttributeValue".is_deleted = false',
      )
      .innerJoinAndSelect(
        'referenceNodeAttributeValue.attribute',
        'referenceNodeAttribute',
        '"referenceNodeAttribute".is_deleted = false',
      );
    this.addFindWhere(query, organizationId, nodeSchemaDto, options);
    // console.log('node with reference attributes query: ', query.getSql());
    const nodes = await query.getMany();
    const normalizedNodes = [];
    for (const node of nodes) {
      // normalize the nodes and merge the reference nodes and back reference nodes
      const nodeDataDto = this.normalizeNodeAttributes(node);
      normalizedNodes.push(nodeDataDto);
    }
    return normalizedNodes;
  }

  protected async findNodeBackReferences(
    organizationId: number,
    nodeSchemaDto: NodeSchemaDto,
    options: NodeFindOptions,
  ): Promise<NodeDataDto[]> {
    const limit = options.limit || 100;
    const offset = (options.page || 0) * limit;
    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      .select('node.id') // only get node id
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
    this.addFindWhere(query, organizationId, nodeSchemaDto, options);
    // console.log('nodes with back references query: ', query.getSql());
    const nodes = await query.getMany();
    const normalizedNodes = [];
    for (const node of nodes) {
      // normalize the nodes and merge the reference nodes and back reference nodes
      const nodeDataDto = this.normalizeNodeAttributes(node);
      normalizedNodes.push(nodeDataDto);
    }
    return normalizedNodes;
  }

  protected async addFindWhere(
    query: SelectQueryBuilder<any>,
    organizationId: number,
    nodeSchemaDto: NodeSchemaDto,
    options: NodeFindOptions,
  ) {
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
            .select('DISTINCT "node"."id"')
            .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
            .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
            .where('"nodeSchemaVersion".id = :versionId', {
              versionId: nodeSchemaDto.versionId,
            });
          if (options.order) {
            this.addOrderFilter(query, nodeSchemaDto, options);
          }
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
            subQuery
              // TODO: handle number_value, date_value, etc.
              .andWhere('"attributeValue"."text_value" LIKE :search', {
                search: `%${options.search}%`,
              });
          }
          return subQuery;
        },
        'node_sub',
        'node_sub."id" = node."id"',
      );
      query.where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      });
    }

    query.andWhere('"nodeSchemaVersion".id = :versionId', {
      versionId: nodeSchemaDto.versionId,
    });
  }

  protected async addAttributeWhere(
    query: SelectQueryBuilder<any>,
    attributeWhereClause: NodeAttributeWhereClause,
  ) {
    query
      .innerJoin(
        'node.attributeValues',
        'attributeValue',
        '"attributeValue".is_deleted = false',
      )
      .innerJoin('attributeValue.attribute', 'attribute');
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

  protected async addOrderFilter(
    query: SelectQueryBuilder<any>,
    nodeSchemaDto: NodeSchemaDto,
    options: NodeFindOptions,
  ) {
    const keys = Object.keys(options.order);
    for (const key of keys) {
      const attribute = _.find(nodeSchemaDto.attributes, { name: key });
      if (!attribute) {
        continue;
      }
      // use subquery to get the sort column as left join since some nodes may not have
      // an attribute value specified and thus we don't want the node to be filtered out
      query.leftJoin(
        subQuery => {
          subQuery
            .from(AttributeValue, 'attributeValue')
            .select('"attributeValue"."node_id"')
            .innerJoin('attributeValue.attribute', 'attribute');
          // pivot the attribute value being sorted into a column
          switch (attribute.type) {
            case AttributeType.Boolean:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'boolean'
              THEN "attributeValue"."number_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.DateTime:
              // TODO: handle Time
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'datetime'
              THEN "attributeValue"."date_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.Enumeration:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'enumeration'
              THEN "attributeValue"."text_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.File:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'file'
              THEN "attributeValue"."text_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.List:
              subQuery.addSelect(`'' as "sort_column"`);
              break;
            case AttributeType.Number:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'number'
              THEN "attributeValue"."number_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.Reference:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'reference'
              THEN "attributeValue"."reference_node_id" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.Sequence:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'sequence'
              THEN "attributeValue"."number_value" ELSE NULL END) as "sort_column"`);
              break;
            case AttributeType.Text:
              subQuery.addSelect(`(CASE WHEN "attribute"."type" = 'text'
              THEN "attributeValue"."text_value" ELSE NULL END) as "sort_column"`);
              break;
          }
          // limit only one attribute (otherwise will cause redundant records to get returned)
          subQuery
            .where('"attribute"."name" = :key', { key })
            .andWhere('"attributeValue".is_deleted = false');
          return subQuery;
        },
        'attributeSort',
        '"attributeSort"."node_id" = "node"."id"',
      );
      const direction =
        options.order[key] && options.order[key].toUpperCase() === 'DESC'
          ? 'DESC'
          : 'ASC';
      // finally add the order by clause
      query.addSelect('sort_column').orderBy('sort_column', direction);
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
    if (node.attributeValues) {
      for (const attributeValue of node.attributeValues) {
        if (!attributeValue.attribute) {
          continue; // attribute may have been deleted
        }
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
            nodeDataDto[
              attributeValue.attribute.name
            ] = noramlizedReferenceNode;
          }
        } else {
          nodeDataDto[attributeValue.attribute.name] =
            attributeValue[fieldName];
        }
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
      case AttributeType.Boolean:
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
          if (!attributeValueDto.id && !value) {
            // don't insert null values into database
            continue;
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
