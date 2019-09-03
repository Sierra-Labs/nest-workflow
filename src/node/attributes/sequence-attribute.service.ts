import * as _ from 'lodash';
import { EntityManager } from 'typeorm';

import { Injectable, BadRequestException } from '@nestjs/common';

import { AttributeValue } from '../../entities/attribute-value.entity';
import { Attribute } from '../../entities/attribute.entity';
import { AttributeValueDto } from '../node.dto';
import { AttributeService } from './attribute.service';
import { NodeSchemaDto } from '../node-schema.dto';
import { User } from '../../entities';

@Injectable()
export class SequenceAttributeService extends AttributeService {
  public async upsertAttributeValue(
    transactionalEntityManager: EntityManager,
    nodeSchemaDto: NodeSchemaDto,
    attributeValueDto: AttributeValueDto,
    user: User,
  ): Promise<AttributeValue> {
    if (!attributeValueDto.nodeId) {
      throw new BadRequestException(
        'upsertAttributeValue error; nodeId not provided for attributeValueDto.',
      );
    }
    const attribute = _.find(nodeSchemaDto.attributes, {
      id: attributeValueDto.attributeId,
    }) as Attribute;
    let attributeValue = await transactionalEntityManager.findOne(
      AttributeValue,
      {
        where: {
          attributeId: attribute.id,
          nodeId: attributeValueDto.nodeId,
        },
      },
    );
    if (attributeValue && attributeValue.numberValue > 0) {
      return attributeValue; // sequence already exists
    }
    if (
      !attribute.options ||
      !attribute.options.start ||
      !attribute.options.increment
    ) {
      throw new BadRequestException('Sequence field not properly configured.');
    }

    // TODO: Need to account for sequence numbers across versions of the schema

    let result = await transactionalEntityManager
      .createQueryBuilder(AttributeValue, 'attributeValue')
      .select('MAX(number_value)::INTEGER  as "lastSequenceValue"')
      .where('attribute_id = :attributeId', { attributeId: attribute.id })
      .getRawOne();
    if (!result || !result.lastSequenceValue) {
      // first record so use start value
      result = { lastSequenceValue: attribute.options.start };
    } else {
      result.lastSequenceValue += attribute.options.increment; // incremenet sequence
    }
    // double check that sequence number is not already in use
    attributeValue = await transactionalEntityManager.findOne(AttributeValue, {
      where: {
        attributeId: attribute.id,
        numberValue: result.lastSequenceValue,
      },
    });
    if (attributeValue) {
      throw new BadRequestException('Error generating new sequence.');
    }
    attributeValue = new AttributeValue();
    attributeValue.attributeId = attribute.id;
    attributeValue.nodeId = attributeValueDto.nodeId;
    attributeValue.numberValue = result.lastSequenceValue;
    attributeValue.textValue = `${attribute.options.prefix || ''}${
      result.lastSequenceValue
    }`;
    attributeValue.createdBy = user;
    attributeValue.modifiedBy = user;
    attributeValue = await transactionalEntityManager.save(attributeValue);
    await this.createAttributeValueLog(
      transactionalEntityManager,
      attributeValue,
    );
    return attributeValue;
  }
}
