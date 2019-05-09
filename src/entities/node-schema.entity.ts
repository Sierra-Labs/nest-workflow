import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { ApiModelProperty } from '@nestjs/swagger';

import { NodeSchemaVersion } from './node-schema-version.entity';
import { Organization } from './organization.entity';
import { User } from './user.entity';

@Entity()
export class NodeSchema {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', {
    comment: 'The organization for the node schema.',
  })
  organizationId: number;

  @ManyToOne(type => Organization, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column('uuid', {
    nullable: true, // first version may not have a version created right away
    comment: 'The current published version of the node schema.',
  })
  publishedVersionId: string;

  @OneToOne(type => NodeSchemaVersion)
  @JoinColumn({ name: 'published_version_id' })
  publishedVersion: NodeSchemaVersion;

  @OneToMany(
    type => NodeSchemaVersion,
    nodeSchemaVersion => nodeSchemaVersion.nodeSchema,
  )
  public versions: NodeSchemaVersion[];

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
