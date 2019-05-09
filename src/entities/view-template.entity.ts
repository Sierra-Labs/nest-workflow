import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';

import { ApiModelProperty } from '@nestjs/swagger';

import { User } from './user.entity';
import { Organization } from './organization.entity';
import { ViewTemplateVersion } from './view-template-version.entity';

@Entity()
export class ViewTemplate {
  @ApiModelProperty()
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('int', {
    comment: 'The organization for the view.',
  })
  organizationId: number;

  @ManyToOne(type => Organization, { nullable: false })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @Column('uuid', {
    nullable: true, // first version may not have a version created right away
    comment: 'The current published version of the view.',
  })
  publishedVersionId: string;

  @OneToOne(type => ViewTemplateVersion)
  @JoinColumn({ name: 'published_version_id' })
  publishedVersion: ViewTemplateVersion;

  @OneToMany(
    type => ViewTemplateVersion,
    viewTemplateVersion => viewTemplateVersion.viewTemplate,
  )
  public versions: ViewTemplateVersion[];

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
