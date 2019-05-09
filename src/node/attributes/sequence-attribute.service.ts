import * as _ from 'lodash';
import { EntityManager } from 'typeorm';

import { Injectable, BadRequestException } from '@nestjs/common';

import { AttributeValue } from '../../entities/attribute-value.entity';
import { Attribute } from '../../entities/attribute.entity';
import { Node } from '../../entities/node.entity';
import { AttributeValueDto } from '../node.dto';
import { AttributeService } from './attribute.service';

@Injectable()
export class SequenceAttributeService extends AttributeService {
  public async upsertAttributeValue(
    transactionalEntityManager: EntityManager,
    node: Node,
    attributeValueDto: AttributeValueDto,
  ): Promise<AttributeValue> {
    const attribute = _.find(node.nodeSchemaVersion.attributes, {
      id: attributeValueDto.attributeId,
    }) as Attribute;
    let attributeValue = await transactionalEntityManager.findOne(
      AttributeValue,
      {
        where: {
          attributeId: attribute.id,
          nodeId: node.id,
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
    if (!result && !result.lastSequenceValue) {
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
    attributeValue.nodeId = node.id;
    attributeValue.numberValue = result.lastSequenceValue;
    attributeValue.textValue = `${attribute.options.prefix}${
      result.lastSequenceValue
    }`;
    attributeValue.createdBy = node.modifiedBy;
    attributeValue.modifiedBy = node.modifiedBy;
    attributeValue = await transactionalEntityManager.save(attributeValue);
    await this.createAttributeValueLog(
      transactionalEntityManager,
      attributeValue,
    );
    return attributeValue;
  }
}
