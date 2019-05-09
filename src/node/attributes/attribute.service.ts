import * as _ from 'lodash';
import { EntityManager } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';

import { AttributeValueLog } from '../../entities/attribute-value-log.entity';
import { AttributeValue } from '../../entities/attribute-value.entity';
import { Node } from '../../entities/node.entity';
import { AttributeValueDto } from '../node.dto';

@Injectable()
export class AttributeService {
  /**
   * Method for updating or inserting new attribute values
   * @param transactionalEntityManager
   * @param node
   * @param attributeValueDto
   */
  public async upsertAttributeValue(
    transactionalEntityManager: EntityManager,
    node: Node,
    attributeValueDto: AttributeValueDto,
  ): Promise<AttributeValue> {
    let attributeValue: AttributeValue;
    if (attributeValueDto.id) {
      // verify attribute value belongs to node
      attributeValue = _.find(node.attributeValues, {
        id: attributeValueDto.id,
      });
      if (!attributeValue) {
        throw new BadRequestException(
          'Attempt to update an attribute that does not exist in the node.',
        );
      }
    } else {
      attributeValue = new AttributeValue();
      attributeValue.createdBy = node.modifiedBy;
    }
    attributeValue.nodeId = node.id;
    attributeValue.attributeId = attributeValueDto.attributeId;
    attributeValue.textValue = attributeValueDto.textValue;
    attributeValue.numberValue = attributeValueDto.numberValue;
    attributeValue.dateValue = attributeValueDto.dateValue;
    attributeValue.timeValue = attributeValueDto.timeValue;
    attributeValue.jsonValue = attributeValueDto.jsonValue;
    attributeValue.referenceNodeId = attributeValueDto.referenceNodeId;
    attributeValue.modifiedBy = node.modifiedBy;
    attributeValue = await transactionalEntityManager.save(attributeValue);
    // createa log entry for the attribute value
    await this.createAttributeValueLog(
      transactionalEntityManager,
      attributeValue,
    );
    return attributeValue;
  }

  public async createAttributeValueLog(
    transactionalEntityManager: EntityManager,
    attributeValue: AttributeValue,
  ): Promise<AttributeValueLog> {
    const attributeValueLog = new AttributeValueLog();
    attributeValueLog.attributeValueId = attributeValue.id;
    attributeValueLog.textValue = attributeValue.textValue;
    attributeValueLog.numberValue = attributeValue.numberValue;
    attributeValueLog.dateValue = attributeValue.dateValue;
    attributeValueLog.timeValue = attributeValue.timeValue;
    attributeValueLog.jsonValue = attributeValue.jsonValue;
    attributeValueLog.referenceNodeId = attributeValue.referenceNodeId;
    attributeValueLog.createdBy = attributeValue.modifiedBy;
    return transactionalEntityManager.save(attributeValueLog);
  }
}
