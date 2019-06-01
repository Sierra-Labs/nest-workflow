import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty, ApiModelPropertyOptional } from '@nestjs/swagger';

import { Attribute } from './attribute.entity';
import { Node } from './node.entity';
import { User } from './user.entity';
import { ColumnNumericTransformer } from '@sierralabs/nest-utils';

@Entity()
export class AttributeValue {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', {
    comment: 'The reference to the node that this attribute value belongs to.',
  })
  nodeId: string;

  @ApiModelProperty()
  @ManyToOne(type => Node, { nullable: false })
  @JoinColumn({ name: 'node_id' })
  node: Node;

  @ApiModelProperty()
  @Column('uuid', {
    nullable: true,
    comment: 'The associated attribute for the value.',
  })
  attributeId: string;

  @ApiModelProperty()
  @ManyToOne(type => Attribute, { nullable: false })
  @JoinColumn({ name: 'attribute_id' })
  attribute: Attribute;

  @ApiModelPropertyOptional()
  @Column('text', {
    nullable: true,
    comment:
      'Depending on `attribute.type` the attribute value maybe stored as text.',
  })
  textValue: string;

  @ApiModelPropertyOptional()
  @Column('numeric', {
    precision: 15,
    scale: 5,
    nullable: true,
    transformer: new ColumnNumericTransformer(),
    comment:
      'Depending on `attribute.type` the attribute value maybe stored as a numeric value.',
  })
  numberValue: number;

  @ApiModelPropertyOptional()
  @Column('date', {
    nullable: true,
    comment:
      'Depending on `attribute.type` and attribute.options the attribute value as date for date only and date time values.',
  })
  dateValue: Date;

  @ApiModelPropertyOptional()
  @Column('time without time zone', {
    nullable: true,
    comment:
      'Depending on `attribute.type` and attribute.options the attribute value as time for time only and date time values.',
  })
  timeValue: string;

  @ApiModelPropertyOptional()
  @Column('jsonb', {
    nullable: true,
    comment:
      'Depending on `attribute.type` the attribute value maybe stored as JSON.',
  })
  jsonValue: any;

  @ApiModelPropertyOptional()
  @Column('uuid', {
    nullable: true,
    comment:
      'Depending on `attribute.type` the attribute value maybe a reference to another node.',
  })
  referenceNodeId: string;

  @ApiModelPropertyOptional()
  @ManyToOne(type => Node, { nullable: true })
  @JoinColumn({ name: 'reference_node_id' })
  referenceNode: Node;

  @Column('boolean', { default: false, select: false })
  isDeleted: boolean;

  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;

  @UpdateDateColumn({ select: false })
  modified: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'modified_by' })
  modifiedBy: User;
}
