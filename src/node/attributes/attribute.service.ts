import * as _ from 'lodash';
import { EntityManager } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';

import { AttributeValueLog } from '../../entities/attribute-value-log.entity';
import { AttributeValue } from '../../entities/attribute-value.entity';
import { Node } from '../../entities/node.entity';
import { AttributeValueDto } from '../node.dto';
import { User } from '../../entities';

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
      if (attributeValue && attributeValue.nodeId !== node.id) {
        throw new BadRequestException(
          `Attempt to update an attribute value (${
            attributeValue.id
          }) that is not associated to the node (${node.id}).`,
        );
      }
    }
    if (!attributeValue) {
      attributeValue = new AttributeValue();
      // client side level generate Ids due to reference nodes
      attributeValue.id = attributeValueDto.id;
      attributeValue.createdBy = node.modifiedBy;
    }
    // TODO: check for unchanged attribute values and ignore rather then
    // saving and then creating an audit log when nothing changed
    attributeValue.nodeId = node.id;
    attributeValue.attributeId = attributeValueDto.attributeId;
    attributeValue.textValue = attributeValueDto.textValue;
    attributeValue.numberValue = attributeValueDto.numberValue;
    attributeValue.dateTimeValue = attributeValueDto.dateTimeValue;
    attributeValue.dateValue = attributeValueDto.dateValue;
    // TODO: validate and format timeValue (HH:MM:SS) otherwise db error
    attributeValue.timeValue = attributeValueDto.timeValue;
    attributeValue.jsonValue = attributeValueDto.jsonValue;
    attributeValue.referenceNodeId = attributeValueDto.referenceNodeId;
    attributeValue.modifiedBy = node.modifiedBy;
    attributeValue.isDeleted = attributeValueDto.isDeleted;
    // TODO: check for if more than one attribute value is being added (i.e. in attribute reference situation)
    attributeValue = await transactionalEntityManager.save(attributeValue);
    // createa log entry for the attribute value
    await this.createAttributeValueLog(
      transactionalEntityManager,
      attributeValue,
    );
    return attributeValue;
  }

  public async deleteAttributeValue(
    transactionalEntityManager: EntityManager,
    nodeId: string,
    user: User,
  ) {
    return transactionalEntityManager.update(
      AttributeValue,
      { referenceNodeId: nodeId },
      {
        isDeleted: true,
        modifiedBy: user,
      },
    );
    // TODO: bulk create attribute value log on delete?
  }

  public async createAttributeValueLog(
    transactionalEntityManager: EntityManager,
    attributeValue: AttributeValue,
  ): Promise<AttributeValueLog> {
    const attributeValueLog = new AttributeValueLog();
    attributeValueLog.attributeValueId = attributeValue.id;
    attributeValueLog.textValue = attributeValue.textValue;
    attributeValueLog.numberValue = attributeValue.numberValue;
    attributeValueLog.dateTimeValue = attributeValue.dateTimeValue;
    attributeValueLog.dateValue = attributeValue.dateValue;
    attributeValueLog.timeValue = attributeValue.timeValue;
    attributeValueLog.jsonValue = attributeValue.jsonValue;
    attributeValueLog.referenceNodeId = attributeValue.referenceNodeId;
    attributeValueLog.createdBy = attributeValue.modifiedBy;
    attributeValueLog.isDeleted = attributeValue.isDeleted;
    return transactionalEntityManager.save(attributeValueLog);
  }
}
