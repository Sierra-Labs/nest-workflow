import * as _ from 'lodash';
import { EntityManager, Repository } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { Node } from '../entities/node.entity';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { NodeDto, AttributeValueDto } from './node.dto';
import { Attribute } from '../entities/attribute.entity';

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
    order: any,
    limit: number = 100,
    offset: number = 0,
    search: string,
    includeDeleted?: boolean,
  ): Promise<[Node[], number]> {
    // TODO: need to figure out how to handle node schema versions
    // -- the attributeIds for attribute values would be different from version to version
    // -- list views that have different node versions currently only accept most recent versions

    // TODO: Implement order, limit, offset, search

    return this.nodeRepository
      .createQueryBuilder('node')
      .leftJoinAndSelect('node.attributeValues', 'attributeValue')
      .leftJoinAndSelect('attributeValue.attribute', 'attribute')
      .innerJoin('node.nodeSchemaVersion', 'nodeSchemaVersion')
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"nodeSchemaVersion".node_schema_id = :nodeSchemaId', {
        nodeSchemaId,
      })
      .getManyAndCount();
  }

  public async findById(organizationId: number, nodeId: string): Promise<Node> {
    return this.nodeRepository
      .createQueryBuilder('node')
      .innerJoinAndSelect('node.nodeSchemaVersion', 'nodeSchemaVersion')
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attributes',
        '"attributes".is_deleted = false',
      )
      .leftJoinAndSelect('node.attributeValues', 'attributeValue')
      .leftJoinAndSelect('attributeValue.attribute', 'attribute')
      .innerJoin('nodeSchemaVersion.nodeSchema', 'nodeSchema')
      .where('"nodeSchema".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"node".id = :nodeId', { nodeId })
      .getOne();
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
    if (!nodeDto.attributeValues || nodeDto.attributeValues.length === 0) {
      throw new BadRequestException(
        'At least one Attribute Value must be provided.',
      );
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
        nodeDto.attributeValues,
      );
    });
    return this.findById(nodeDto.organizationId, node.id);
  }

  public async update(nodeDto: NodeDto): Promise<Node> {
    const node = await this.findById(nodeDto.organizationId, nodeDto.id);
    if (!node) {
      throw new BadRequestException('Node not found.');
    }
    if (!nodeDto.attributeValues || nodeDto.attributeValues.length === 0) {
      throw new BadRequestException(
        'At least one Attribute Value must be provided.',
      );
    }
    // updated modified by
    node.modifiedBy = nodeDto.modifiedBy;

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      await transactionalEntityManager.save(node);
      await this.upsertAttributeValues(
        transactionalEntityManager,
        node,
        nodeDto.attributeValues,
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
}
