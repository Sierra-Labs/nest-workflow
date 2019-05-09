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

import { AttributeValue } from './attribute-value.entity';
import { Node } from './node.entity';
import { User } from './user.entity';

@Entity()
export class AttributeValueLog {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiModelProperty()
  @Column('uuid', {
    nullable: true,
    comment: 'The associated attribute value this log belongs to.',
  })
  attributeValueId: string;

  @ApiModelProperty()
  @ManyToOne(type => AttributeValue, { nullable: false })
  @JoinColumn({ name: 'attribute_value_id' })
  attributeValue: AttributeValue;

  @ApiModelPropertyOptional()
  @Column('text', {
    nullable: true,
    comment: 'A snapshot of the text value at the time of the log entry.',
  })
  textValue: string;

  @ApiModelPropertyOptional()
  @Column('numeric', {
    precision: 15,
    scale: 5,
    nullable: true,
    comment: 'A snapshot of the number value at the time of the log entry.',
  })
  numberValue: number;

  @ApiModelPropertyOptional()
  @Column('date', {
    nullable: true,
    comment: 'A snapshot of the date value at the time of the log entry.',
  })
  dateValue: Date;

  @ApiModelPropertyOptional()
  @Column('time without time zone', {
    nullable: true,
    comment: 'A snapshot of the time value at the time of the log entry.',
  })
  timeValue: string;

  @ApiModelPropertyOptional()
  @Column('jsonb', {
    nullable: true,
    comment: 'A snapshot of the json value at the time of the log entry.',
  })
  jsonValue: any;

  @ApiModelPropertyOptional()
  @Column('uuid', {
    nullable: true,
    comment: 'A snapshot of the reference node at the time of the log entry.',
  })
  referenceNodeId: string;

  @ApiModelPropertyOptional()
  @ManyToOne(type => Node, { nullable: true })
  @JoinColumn({ name: 'reference_node_id' })
  referenceNode: Node;

  @CreateDateColumn({ select: false })
  created: Date;

  @ManyToOne(type => User, { nullable: false })
  @JoinColumn({ name: 'created_by' })
  createdBy: User;
}
