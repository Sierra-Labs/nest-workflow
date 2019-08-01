import { Validator } from 'class-validator';
import * as _ from 'lodash';
import { EntityManager, Repository, SelectQueryBuilder } from 'typeorm';

import {
  BadRequestException,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import {
  AttributeValue,
  ReferenceType,
  User,
  Attribute,
  WorkflowTrigger,
} from '../entities';
import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { Node } from '../entities/node.entity';
import { AttributeType } from './attributes';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { NodeSchemaDto } from './node-schema.dto';
import { NodeSchemaService } from './node-schema.service';
import { AttributeValueDto } from './node.dto';
import {
  NodeAttributeWhereClause,
  NodeFindOptions,
  NodeService,
} from './node.service';
import { WorkflowService } from '../workflow';
import { WorkflowMachine } from '../workflow/workflow.machine';

export interface NodeDataDto {
  nodeId?: string;
  nodeSchemaVersionId?: string;
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
    protected readonly workflowService: WorkflowService,
    protected readonly configService: ConfigService,
    protected readonly attributeService: AttributeService,
    protected readonly sequenceAttributeService: SequenceAttributeService,
  ) {}

  public async find(
    organizationId: number,
    nodeSchemaNameOrDto: string | NodeSchemaDto,
    options?: NodeFindOptions,
  ): Promise<[NodeDataDto[], number]> {
    if (!options) {
      options = {};
    }
    let nodeSchemaDto: NodeSchemaDto;
    if (typeof nodeSchemaNameOrDto === 'string') {
      const nodeSchemaName = _.camelCase(nodeSchemaNameOrDto); // convert node schema name to camel case
      // need to get the nodeSchema to access meta data when building the query
      nodeSchemaDto = await this.nodeSchemaService.findByName(
        organizationId,
        nodeSchemaName,
      );
    } else {
      nodeSchemaDto = nodeSchemaNameOrDto;
    }
    const limit = options.limit || 100;
    const offset = (options.page || 0) * limit;
    // first get the node and attribute values in the correct order
    const query = this.nodeRepository
      .createQueryBuilder('node')
      .take(limit)
      .skip(offset)
      .select(['node.id', 'node.nodeSchemaVersionId'])
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
    if (options.includeReferences || options.relations) {
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
      .select(['node.id', 'node.nodeSchemaVersionId'])
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
      .innerJoinAndSelect(
        'attributeValue.referenceNode',
        'referenceNode0',
        '"referenceNode0".is_deleted = false',
      )
      .innerJoinAndSelect(
        'referenceNode0.attributeValues',
        'referenceNodeAttributeValue0',
        '"referenceNodeAttributeValue0".is_deleted = false',
      )
      .innerJoinAndSelect(
        'referenceNodeAttributeValue0.attribute',
        'referenceNodeAttribute0',
        '"referenceNodeAttribute0".is_deleted = false',
      );
    this.addFindWhere(query, organizationId, nodeSchemaDto, options);
    if (options.relations) {
      // filter by specified relations
      const referenceAttributeNames = [];
      const subReferenceAttributeNames = [];
      for (const relation of options.relations) {
        // traverse the sub-relationship tree
        const relationPath = relation.split('.'); // supports dot notation
        if (!options.includeReferences) {
          // limit relations if not including all references
          referenceAttributeNames.push(relationPath[0]);
        }
        if (relationPath.length > 1) {
          // sub-relationships
          relationPath.forEach((attributeName, index) => {
            if (index === 0) {
              return; // skip first immediate child attribute item as handled above
            }
            if (!subReferenceAttributeNames[index]) {
              // add nested query for each tree leaf (only once)
              subReferenceAttributeNames[index] = [];
              query
                .leftJoinAndSelect(
                  `referenceNodeAttributeValue${index - 1}.referenceNode`,
                  `referenceNode${index}`,
                  `"referenceNode${index}".is_deleted = false AND "referenceNodeAttribute${index -
                    1}"."name" IN (:...attributeNames${index})`,
                  {
                    [`attributeNames${index}`]: subReferenceAttributeNames[index],
                  },
                )
                .leftJoinAndSelect(
                  `referenceNode${index}.attributeValues`,
                  `referenceNodeAttributeValue${index}`,
                  `"referenceNodeAttributeValue${index}".is_deleted = false`,
                )
                .leftJoinAndSelect(
                  `referenceNodeAttributeValue${index}.attribute`,
                  `referenceNodeAttribute${index}`,
                  `"referenceNodeAttribute${index}".is_deleted = false`,
                );
            }
            // only get sub reference nodes for specified attribute name
            subReferenceAttributeNames[index].push(attributeName);
          });
        }
      }
      if (referenceAttributeNames.length > 0) {
        // if filtering by specific relationships (i.e !includeAllReferences)
        query.andWhere('"attribute"."name" IN (:...referenceAttributeNames)', {
          referenceAttributeNames,
        });
      }
    }
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
      .select(['node.id', 'node.nodeSchemaVersionId'])
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
    query.where('"nodeSchema".organization_id = :organizationId', {
      organizationId,
    });
    if (options.nodeId) {
      query.andWhere('"node"."id" = :nodeId', { nodeId: options.nodeId });
    } else {
      query.innerJoin(
        subQuery => {
          subQuery
            .from(Node, 'node')
            .select('"node"."id"')
            .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
            .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
            .where(
              '"nodeSchemaVersion".id = :versionId AND "node".is_deleted = false',
              {
                versionId: nodeSchemaDto.versionId,
              },
            );
          if (options.order) {
            this.addOrderFilter(query, nodeSchemaDto, options);
          }
          if (options.where || options.search) {
            if (options.where instanceof Array) {
              // TODO: implement OR logic
              // subQuery.andWhere(new Brackets(bracketQuery => {
              //   bracketQuery.orWhere()
              // }));
              // for (const where of options.where) {
              //   subQuery.andWhere('"attribute"."name" = :name', {});
              // }
            } else {
              try {
                this.addAttributeWhere(query, subQuery, options);
              } catch (error) {
                throw error;
              }
            }
          }
          subQuery.groupBy('"node"."id"');
          return subQuery;
        },
        'node_sub',
        'node_sub."id" = node."id"',
      );
    }

    query.andWhere('"nodeSchemaVersion".id = :versionId', {
      versionId: nodeSchemaDto.versionId,
    });
  }

  protected async addAttributeWhere(
    mainQuery: SelectQueryBuilder<any>,
    subQuery: SelectQueryBuilder<any>,
    options: NodeFindOptions,
  ) {
    subQuery
      .innerJoin(
        'node.attributeValues',
        'attributeValue',
        '"attributeValue".is_deleted = false',
      )
      .innerJoin('attributeValue.attribute', 'attribute');
    if (options.search) {
      const validator = new Validator();
      if (validator.isUUID(options.search)) {
        // autocomplete view uses this when setting default / pre-populated form fields
        subQuery.andWhere('"node"."id" = :nodeId', { nodeId: options.search });
      } else {
        // TODO: handle number_value, date_value, etc.
        subQuery.andWhere('"attributeValue"."text_value" ILIKE :search', {
          search: `%${options.search}%`,
        });
      }
    }
    if (options.where) {
      const whereClause = options.where as NodeAttributeWhereClause;
      const keys = Object.keys(whereClause);
      keys.forEach((key, index) => {
        if (key === 'referenceNodeId') {
          // filter to get forward reference relationships
          subQuery.andWhere('"attributeValue"."reference_node_id" = :value', {
            value: whereClause.referenceNodeId,
          });
        } else if (key === 'backReferenceNodeId') {
          // filter to get back reference relationships
          subQuery
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
              { nodeId: whereClause.backReferenceNodeId },
            );
        } else if (key === 'nodeSchemaVersionId') {
          // skip nodeSchemaVersionId
        } else {
          // attribute reference search
          // each where param must have a unique key in query builder
          let shouldIgnoreKey = false;
          const whereParams = {} as any;
          const whereNameKey = `attribute${index}`;
          const whereValueKey = `value${index}`;
          whereParams[whereNameKey] = key;
          whereParams[whereValueKey] = whereClause[key];

          let attributeValueField: string;
          const validator = new Validator();
          const whereValue = whereClause[key];
          if (whereValue instanceof Array && whereValue.length > 0) {
            mainQuery.andWhere(
              `${whereNameKey} IN (:...${whereValueKey})`,
              whereParams,
            );
            if (validator.isUUID(whereValue[0])) {
              // use first item in array to test if UUID
              attributeValueField = 'reference_node_id';
            } else {
              attributeValueField = 'text_value';
            }
          } else if (validator.isUUID(whereValue as string)) {
            attributeValueField = 'reference_node_id';
            mainQuery.andWhere(
              `${whereNameKey} = :${whereValueKey}`,
              whereParams,
            );
          } else if (typeof whereValue === 'number') {
            attributeValueField = 'number_value';
            // TODO: handle >, >=, <, <= and range
            mainQuery.andWhere(
              `${whereNameKey} = :${whereValueKey}`,
              whereParams,
            );
          } else if (typeof whereValue === 'string') {
            attributeValueField = 'text_value';
            whereParams[whereValueKey] = `%${whereClause[key]}%`;
            mainQuery.andWhere(
              `${whereNameKey} ILIKE :${whereValueKey}`,
              whereParams,
            );
          } else if (
            whereValue &&
            (whereValue as any).start &&
            (whereValue as any).end
          ) {
            // search range
            const start = (whereValue as any).start;
            const end = (whereValue as any).end;
            if (
              (validator.isNumber(start) || validator.isNumberString(start)) &&
              (validator.isNumber(end) || validator.isNumberString(end))
            ) {
              attributeValueField = 'number_value';
              mainQuery.andWhere(
                // since we are validating number values string concat below is not at risk to sql injection
                `${whereNameKey} >= ${start} AND ${whereNameKey} <= ${end}`,
                whereParams, // whereParams needed for main select query `case when` statement
              );
            } else if (
              validator.isDateString(start) &&
              validator.isDateString(end)
            ) {
              attributeValueField = 'date_time_value';
              mainQuery.andWhere(
                // since we are validating date values string concat below is not at risk to sql injection
                `${whereNameKey} >= '${start}' AND ${whereNameKey} <= '${end}'`,
                whereParams, // whereParams needed for main select query `case when` statement
              );
            } else {
              // not number or date values for start/end parameters
              shouldIgnoreKey = true;
            }
          } else if (
            whereValue &&
            (whereValue as any).nodeId &&
            validator.isUUID((whereValue as any).nodeId as string)
          ) {
            // Reference Node search; provided filter is an object (i.e. from the autocomplete field)
            attributeValueField = 'reference_node_id';
            whereParams[whereValueKey] = (whereValue as any).nodeId;
            mainQuery.andWhere(
              `${whereNameKey} = :${whereValueKey}`,
              whereParams,
            );
          } else {
            // could not identify filter inputs
            shouldIgnoreKey = true;
          }
          if (!shouldIgnoreKey) {
            const sqlCast =
              attributeValueField === 'reference_node_id' ? '::text' : ''; // cast uuid property to string
            subQuery.addSelect(
              `MAX(CASE WHEN "attribute"."name" = :${whereNameKey}
               THEN "attributeValue"."${attributeValueField}"${sqlCast} END) as "${whereNameKey}"`,
            );
          }
        }
      });
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
    nodeSchemaNameOrDto: string | NodeSchemaDto,
    nodeId: string,
    options?: NodeFindOptions,
  ): Promise<NodeDataDto> {
    const results = await this.find(organizationId, nodeSchemaNameOrDto, {
      nodeId,
      ...options,
    });
    return results[0][0];
  }

  public normalizeNodeAttributes(node: Node): NodeDataDto {
    const nodeDataDto = {
      nodeId: node.id,
      nodeSchemaVersionId: node.nodeSchemaVersionId,
    } as NodeDataDto;
    if (node.attributeValues) {
      for (const attributeValue of node.attributeValues) {
        if (!attributeValue.attribute) {
          continue; // attribute may have been deleted
        }
        const fieldName = this.getAttributeValueFieldNameByType(
          attributeValue.attribute,
        );
        if (
          attributeValue.attribute.type === AttributeType.Reference &&
          attributeValue.referenceNode
        ) {
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
          if (
            attributeValue.attribute.type === AttributeType.Enumeration &&
            attributeValue.attribute.options.isMultiSelect
          ) {
            // multi-select always get jsonValue
            nodeDataDto[attributeValue.attribute.name] =
              attributeValue.jsonValue;
          } else {
            nodeDataDto[attributeValue.attribute.name] =
              attributeValue[fieldName];
          }
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

  public getAttributeValueFieldNameByType(attribute: Attribute): string {
    switch (attribute.type) {
      case AttributeType.DateTime:
        switch (attribute.options.type) {
          case 'DATE_TIME':
            return 'dateTimeValue';
          case 'DATE_ONLY':
            return 'dateValue';
          case 'TIME_ONLY':
            return 'timeValue';
        }
      case AttributeType.File:
      case AttributeType.List:
        return 'jsonValue';
      case AttributeType.Number:
      case AttributeType.Boolean:
        return 'numberValue';
      case AttributeType.Reference:
        return 'referenceNodeId';
      case AttributeType.Enumeration:
      case AttributeType.Sequence:
      case AttributeType.Text:
      default:
        return 'textValue';
    }
  }

  // public async create(
  //   nodeSchemaName: string,
  //   nodeDataDto: NodeDataDto,
  //   user: User,
  // ): Promise<NodeDataDto> {
  //   const nodeSchemaVersion = await this.entityManager
  //     .createQueryBuilder(NodeSchemaVersion, 'nodeSchemaVersion')
  //     .leftJoinAndSelect(
  //       'nodeSchemaVersion.attributes',
  //       'attributes',
  //       '"attributes".is_deleted = false',
  //     )
  //     .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
  //     .where('"nodeSchema".organization_id = :organizationId', {
  //       organizationId: user.activeOrganization.id,
  //     })
  //     .andWhere('"nodeSchemaVersion".name = :nodeSchemaName', {
  //       nodeSchemaName,
  //     })
  //     .getOne();
  //   if (!nodeSchemaVersion) {
  //     throw new BadRequestException('Node Schema not found.');
  //   }
  //   // save in a SQL transaction
  //   let node;
  //   await this.entityManager.transaction(async transactionalEntityManager => {
  //     node = await this.createWithTransaction(
  //       transactionalEntityManager,
  //       nodeSchemaVersion,
  //       nodeDataDto,
  //       user,
  //     );
  //   });
  //   return this.findById(user.activeOrganization.id, nodeSchemaName, node.id);
  // }

  // protected async createWithTransaction(
  //   transactionalEntityManager: EntityManager,
  //   nodeSchemaVersion: NodeSchemaVersion,
  //   nodeDataDto: NodeDataDto,
  //   user: User,
  // ): Promise<Node> {
  //   let node = new Node();
  //   node.nodeSchemaVersionId = nodeSchemaVersion.id;
  //   node.createdBy = user;
  //   node.modifiedBy = user;
  //   node.attributeValues = [];

  //   node = await transactionalEntityManager.save(node);
  //   // assign the nodeSchemaVersion for use when processing attribute values
  //   node.nodeSchemaVersion = nodeSchemaVersion;
  //   await this.upsertAttributeValues(
  //     transactionalEntityManager,
  //     node,
  //     nodeDataDto,
  //   );
  //   return node;
  // }

  public async upsertMultiple(
    nodeDataDtos: NodeDataDto[],
    user: User,
  ): Promise<NodeDataDto[]> {
    const results = [];
    await this.entityManager.transaction(async transactionalEntityManager => {
      for (const nodeDataDto of nodeDataDtos) {
        results.push(
          await this.recursiveUpsertWithTransaction(
            transactionalEntityManager,
            nodeDataDto,
            user,
          ),
        );
      }
    });
    return results;
  }

  public async recursiveUpsert(
    upsertNodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    let results;
    await this.entityManager.transaction(async transactionalEntityManager => {
      results = await this.recursiveUpsertWithTransaction(
        transactionalEntityManager,
        upsertNodeDataDto,
        user,
      );
    });
    return results;
  }

  public async recursiveUpsertWithTransaction(
    transactionalEntityManager: EntityManager,
    upsertNodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    if (!upsertNodeDataDto.nodeSchemaVersionId) {
      throw new BadRequestException('nodeSchemaVersionId is required.');
    }
    const nodeSchemaDto = await this.nodeSchemaService.findVersionById(
      user.activeOrganization.id,
      upsertNodeDataDto.nodeSchemaVersionId,
    );
    if (!nodeSchemaDto) {
      throw new BadRequestException('Node Schema not found.');
    }

    // check if updating or inserting the record
    let nodeDataDto: NodeDataDto;
    if (upsertNodeDataDto.nodeId) {
      // TODO: need a better way to handle workflow validation checks
      // currently since we are passing only deltas for upsertNodeDataDto
      // we need to get the complete NodeDataDto for workflow validation
      nodeDataDto = await this.findById(
        user.activeOrganization.id,
        nodeSchemaDto,
        upsertNodeDataDto.nodeId,
        {
          // TODO: Consider removing the reference calls to speed up query
          includeBackReferences: true,
          includeReferences: true,
        },
      );
    } else {
      // inserting new record so initialize nodeDataDto with nodeSchemaVersionId
      nodeDataDto = { nodeSchedmaVersionId: nodeSchemaDto.versionId };
    }

    // Run upsert through workflow if exists
    const workflows = await this.workflowService.findByNodeSchemaVersionId(
      user.activeOrganization.id,
      nodeSchemaDto.versionId,
    );
    let hasRunWorkflow = false;
    if (workflows && workflows.length > 0) {
      for (const workflow of workflows) {
        if (workflow.triggers.includes(WorkflowTrigger.Update)) {
          const workflowMachine = new WorkflowMachine();
          workflow.config.context = {
            nodeDataService: this,
            transactionalEntityManager,
            user,
            nodeSchemaDto,
            nodeDataDto: { ...nodeDataDto, ...upsertNodeDataDto }, // the combined nodeDatDto to validate
            upsertNodeDataDto, // the nodeDataDto delta to upsert
            originalNodeDataDto: nodeDataDto, // The original nodeDataDto for comparison
          };
          const results = await workflowMachine.run(workflow.config);
          if (results.context && results.context.errors) {
            // TODO: refine error handling
            throw new HttpException(
              {
                status: HttpStatus.BAD_REQUEST,
                errors: results.context.errors,
              },
              400,
            );
          }
          hasRunWorkflow = true;
        }
      }
    }
    if (!hasRunWorkflow) {
      // if no workflow has been run then upsert
      upsertNodeDataDto = this.upsertWithoutWorkflow(
        transactionalEntityManager,
        nodeSchemaDto,
        upsertNodeDataDto,
        user,
      );
    }

    // recursive upsert - find any child NodeDataDtos and upsert them
    const keys = Object.keys(upsertNodeDataDto);
    for (const key of keys) {
      // if object has a nodeSchemaVersionId then assume its a NodeDataDto
      if (upsertNodeDataDto[key] && upsertNodeDataDto[key] instanceof Array) {
        for (const subNodeDataDto of upsertNodeDataDto[key]) {
          if (subNodeDataDto && subNodeDataDto.nodeSchemaVersionId) {
            await this.recursiveUpsertWithTransaction(
              transactionalEntityManager,
              subNodeDataDto,
              user,
            );
          }
        }
      } else if (
        upsertNodeDataDto[key] &&
        upsertNodeDataDto[key].nodeSchedmaVersionId
      ) {
        await this.recursiveUpsertWithTransaction(
          transactionalEntityManager,
          upsertNodeDataDto[key],
          user,
        );
      }
    }
    // return the upsertNodeDataDto with nodeIds for all created nodes
    return upsertNodeDataDto;
  }

  /**
   * Used by workflow to perform upsert action (see workflow-services.ts)
   * Rarely should this be used to bypass workflow checks
   */
  public async upsertWithoutWorkflow(
    transactionalEntityManager: EntityManager,
    nodeSchemaDto: NodeSchemaDto,
    upsertNodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    const upsertNode = new Node();
    upsertNode.modifiedBy = user;
    if (upsertNodeDataDto.nodeId) {
      upsertNode.id = upsertNodeDataDto.nodeId;
    } else {
      upsertNode.nodeSchemaVersionId = upsertNodeDataDto.nodeSchemaVersionId;
      upsertNode.createdBy = user;
    }
    const node = await transactionalEntityManager.save(upsertNode);
    upsertNodeDataDto.nodeId = node.id;
    await this.upsertAttributeValues(
      transactionalEntityManager,
      nodeSchemaDto,
      upsertNodeDataDto,
      user,
    );
    return upsertNodeDataDto;
  }

  public async delete(nodeId: string, user: User): Promise<boolean> {
    // TODO: check for "Delete" workflows and process workflow
    const node = await this.nodeService.findById(
      user.activeOrganization.id,
      nodeId,
    );
    if (!node) {
      throw new BadRequestException('Node not found.');
    }
    const updateNode = new Node();
    updateNode.id = node.id;
    updateNode.isDeleted = true;
    updateNode.modifiedBy = user;
    node.modifiedBy = user; // needed for attribute values
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(updateNode);
      await this.attributeService.deleteAttributeValue(
        transactionalEntityManager,
        nodeId,
        user,
      );
    });
    return true;
  }

  public async createReferenceNode(
    nodeSchemaName: string,
    nodeId: string,
    referenceAttributeName: string,
    nodeDataDto: NodeDataDto,
    user: User,
  ): Promise<NodeDataDto> {
    // check user has access to the source node schema
    const nodeSchemaDto = await this.nodeSchemaService.findByName(
      user.activeOrganization.id,
      nodeSchemaName,
    );
    if (!nodeSchemaDto) {
      throw new BadRequestException('Node Schema not found.');
    }

    // check if attribute is actually a reference field
    const attribute = _.find(nodeSchemaDto.attributes, {
      name: referenceAttributeName,
    });
    if (!attribute || attribute.type !== AttributeType.Reference) {
      throw new BadRequestException('Not a Reference Attribute.');
    }

    // check if the source node exists
    const sourceNodeDataDto = await this.findById(
      user.activeOrganization.id,
      nodeSchemaDto,
      nodeId,
    );
    if (!sourceNodeDataDto) {
      throw new BadRequestException('Source node not found.');
    }

    // check if only one reference allows and validate
    if (
      attribute.options.referenceType === ReferenceType.OneToOne ||
      attribute.options.referenceType === ReferenceType.ManyToOne
    ) {
      // get attribute values using nodeId
      if (sourceNodeDataDto[referenceAttributeName]) {
        throw new BadRequestException(
          `A reference node already exists. Adding a reference node would violate the ${
            attribute.options.referenceType
          } constraint for ${referenceAttributeName}.`,
        );
      }
    }

    await this.entityManager.transaction(async transactionalEntityManager => {
      nodeDataDto = await this.recursiveUpsertWithTransaction(
        transactionalEntityManager,
        nodeDataDto,
        user,
      );
      // assign the newly created reference node's id to the source node's reference field
      sourceNodeDataDto[referenceAttributeName] = nodeDataDto.nodeId;
      await this.upsertWithoutWorkflow(
        transactionalEntityManager,
        nodeSchemaDto,
        sourceNodeDataDto,
        user,
      );
    });
    return nodeDataDto;
  }

  protected async upsertAttributeValues(
    transactionalEntityManager: EntityManager,
    nodeSchemaDto: NodeSchemaDto,
    nodeDataDto: NodeDataDto,
    user: User,
  ): Promise<boolean> {
    // get existing attribute values if updating
    const attributeValues = await transactionalEntityManager.find(
      AttributeValue,
      { where: { nodeId: nodeDataDto.nodeId } },
    );

    // Loop through all attributes and see if there's needed processing
    // (example: Sequence attributes need to be auto generated)
    for (const attribute of nodeSchemaDto.attributes) {
      switch (attribute.type) {
        case 'sequence':
          await this.sequenceAttributeService.upsertAttributeValue(
            transactionalEntityManager,
            nodeSchemaDto,
            // sequence generates attribute values so pass in the attribute id only
            { nodeId: nodeDataDto.nodeId, attributeId: attribute.id },
            user,
          );
          break;
        default:
          // some attributes can have one or more attribute values (so filter)
          const filteredAttributeValues = _.filter(attributeValues, {
            attributeId: attribute.id,
          }) as AttributeValue[];
          const value = nodeDataDto[attribute.name];
          const attributeValueDto: AttributeValueDto = {
            attributeId: attribute.id,
            nodeId: nodeDataDto.nodeId,
          };
          const fieldName = this.getAttributeValueFieldNameByType(attribute);
          if (!value && filteredAttributeValues.length > 0) {
            continue; // no data for attribute
          } else if (
            !value &&
            filteredAttributeValues.length === 0 &&
            attribute.options.default
          ) {
            // Default attribute value available so use it
            attributeValueDto[fieldName] = attribute.options.default;
          } else if (value || value === null) {
            if (filteredAttributeValues.length > 0) {
              attributeValueDto.id = filteredAttributeValues[0].id;
            }
            // null values are treated as intentitional clearing of attribute value
            if (attribute.type === AttributeType.Reference) {
              // reference value could be an object of the reference node or it could be the UUID of
              // the reference node
              const validator = new Validator();
              if (validator.isUUID(value)) {
                attributeValueDto.referenceNodeId = value;
              } else {
                attributeValueDto.referenceNodeId =
                  value && value.nodeId ? value.nodeId : null;
              }
            } else if (attribute.type === AttributeType.File) {
              attributeValueDto.jsonValue = value;
              // store file name(s) in textValue for searchability
              if (value instanceof Array) {
                attributeValueDto.textValue = value
                  .map(file => (file ? file.name : file))
                  .join(', ');
              } else {
                attributeValueDto.textValue = value.name;
              }
            } else {
              if (value instanceof Array && fieldName === 'textValue') {
                attributeValueDto.jsonValue = value;
                attributeValueDto[fieldName] = value.join(', ');
              } else {
                attributeValueDto[fieldName] = value;
              }
            }
          }
          if (!attributeValueDto.id && !attributeValueDto[fieldName]) {
            // don't insert null values into database when creating new records
            continue;
          }
          await this.attributeService.upsertAttributeValue(
            transactionalEntityManager,
            nodeSchemaDto,
            attributeValueDto,
            user,
          );
      }
    }
    return true; // needed for async/await
  }
}
