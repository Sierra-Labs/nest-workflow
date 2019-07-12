import * as _ from 'lodash';
import { EntityManager } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';

import { AttributeValueLog } from '../../entities/attribute-value-log.entity';
import { AttributeValue } from '../../entities/attribute-value.entity';
import { Node } from '../../entities/node.entity';
import { AttributeValueDto } from '../node.dto';
import { User } from '../../entities';
import { NodeSchemaDto } from '../node-schema.dto';

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
    nodeSchemaDto: NodeSchemaDto, // although not used in this method; it can be used in subclassed implementation (see sequence attribute)
    attributeValueDto: AttributeValueDto,
    user: User,
  ): Promise<AttributeValue> {
    if (!attributeValueDto.nodeId) {
      throw new BadRequestException(
        'upsertAttributeValue error; nodeId not provided for attributeValueDto.',
      );
    }

    // TODO implement bulk attribute insert/update, which verifies node association when bulk updating

    // let attributeValue: AttributeValue;
    // if (attributeValueDto.id) {
    //   // verify attribute value belongs to node
    //   attributeValue = _.find(nodeSchemaDto.attributeValues, {
    //     id: attributeValueDto.id,
    //   });
    //   if (attributeValue && attributeValue.nodeId !== node.id) {
    //     throw new BadRequestException(
    //       `Attempt to update an attribute value (${
    //         attributeValue.id
    //       }) that is not associated to the node (${node.id}).`,
    //     );
    //   }
    // }
    // if (!attributeValue) {
    //   attributeValue = new AttributeValue();
    //   // client side level generate Ids due to reference nodes
    //   attributeValue.id = attributeValueDto.id;
    //   attributeValue.createdBy = node.modifiedBy;
    // }

    // TODO: in bulk update only update if data changed
    // TODO: validate and format timeValue (HH:MM:SS) otherwise db error

    let attributeValue = new AttributeValue();
    Object.assign(attributeValue, attributeValueDto);
    attributeValue.modifiedBy = user;
    if (!attributeValue.id) {
      attributeValue.createdBy = user;
    }
    // TODO: check if more than one attribute value is being added (i.e. in attribute reference situation)
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
