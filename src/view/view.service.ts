import * as S3 from 'aws-sdk/clients/s3';
import { EntityManager, Repository } from 'typeorm';

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@sierralabs/nest-utils';

import { ViewTemplateVersion } from '../entities/view-template-version.entity';
import { ViewTemplate } from '../entities/view-template.entity';
import { FindViewTemplateDto, ViewTemplateDto } from './view.dto';
import { NodeSchemaDto } from '../node/node-schema.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class ViewService {
  s3client: S3;
  s3Info: any;
  bucketName: string;

  constructor(
    protected readonly entityManager: EntityManager,
    @InjectRepository(ViewTemplate)
    protected readonly viewTemplateRepository: Repository<ViewTemplate>,
    @InjectRepository(ViewTemplateVersion)
    protected readonly viewTemplateVersionRepository: Repository<
      ViewTemplateVersion
    >,
    protected readonly configService: ConfigService,
  ) {
    const config = configService.get('aws');
    this.s3Info = config.s3;
    this.s3Info.accessKeyId = config.accessKeyId;
    this.s3Info.secretAccessKey = config.secretAccessKey;
    this.s3Info.region = config.region;
    this.s3client = new S3(this.s3Info);
    this.bucketName = configService.get('aws.s3.bucket');
  }

  public async find(
    organizationId: number,
    order: any,
    limit: number = 100,
    offset: number = 0,
    search: string,
    includeDeleted?: boolean,
  ): Promise<[FindViewTemplateDto[], number]> {
    const query = this.viewTemplateRepository
      .createQueryBuilder('viewTemplate')
      .select([
        '"viewTemplate"."id" as "id"',
        '"publishedVersion"."id" as "publishedVersionId"',
        '"publishedVersion"."name" as "publishedName"',
        '"publishedVersion"."version" as "publishedVersion"',
        '"publishedVersion"."modified" as "publishedDate"',
        '"latestVersion"."id" as "latestVersionId"',
        '"latestVersion"."name" as "latestVersionName"',
        '"latestVersion"."version" as "latestVersion"',
        '"latestVersion"."modified" as "latestVersionDate"',
      ])
      .leftJoin('viewTemplate.publishedVersion', 'publishedVersion')
      .leftJoin(
        subQuery => {
          return subQuery
            .from(subSubQuery => {
              return subSubQuery
                .from(ViewTemplateVersion, 'viewTemplateVersion')
                .select([
                  'id',
                  'view_template_id',
                  'name',
                  'version',
                  'modified',
                  `row_number() OVER ( PARTITION by "id" ORDER BY "version" DESC	) as row_num`,
                ]);
            }, 'version')
            .where('row_num = 1');
        },
        'latestVersion',
        '"latestVersion"."view_template_id" = "viewTemplate"."id"',
      )
      .where(
        '"publishedVersion"."name" ILIKE :search OR "latestVersion"."name" ILIKE :search',
        { search },
      )
      .andWhere('"viewTemplate".organization_id = :organizationId', {
        organizationId,
      });

    if (!includeDeleted) {
      query.andWhere('"viewTemplate".is_deleted = false');
    }
    const count = await query.getCount();
    const results = await query
      .orderBy(order)
      .limit(limit)
      .offset(offset)
      .getRawMany();
    return [results, count];
  }

  public async findById(
    organizationId: number,
    viewId: string,
  ): Promise<ViewTemplateDto> {
    const viewTemplate = await this.viewTemplateRepository
      .createQueryBuilder('view')
      .leftJoinAndSelect('view.publishedVersion', 'publishedVersion')
      .leftJoinAndSelect(
        'publishedVersion.nodeSchemaVersion',
        'nodeSchemaVersion',
      )
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attribute',
        '"attribute".is_deleted = false',
      )
      .where('view.organization_id = :organizationId', { organizationId })
      .andWhere('view.id = :viewId', { viewId })
      .orderBy('"attribute".position', 'ASC')
      .getOne();
    if (!viewTemplate) {
      throw new BadRequestException('View Template not found.');
    }
    return this.mapToViewTemplateDto(viewTemplate.publishedVersion);
  }

  public async findVersionById(
    organizationId: number,
    viewTemplateVersionId: string,
  ): Promise<ViewTemplateDto> {
    const viewTemplateVersion = await this.viewTemplateVersionRepository
      .createQueryBuilder('viewTemplateVersion')
      .innerJoin('viewTemplateVersion.viewTemplate', 'viewTemplate')
      .leftJoinAndSelect(
        'viewTemplateVersion.nodeSchemaVersion',
        'nodeSchemaVersion',
      )
      .leftJoinAndSelect(
        'nodeSchemaVersion.attributes',
        'attribute',
        '"attribute".is_deleted = false',
      )
      .where('"viewTemplate".organization_id = :organizationId', {
        organizationId,
      })
      .andWhere('"viewTemplateVersion".id = :viewTemplateVersionId', {
        viewTemplateVersionId,
      })
      .orderBy('"attribute".position', 'ASC')
      .getOne();
    if (!viewTemplateVersion) {
      throw new BadRequestException('View Template not found.');
    }

    return this.mapToViewTemplateDto(viewTemplateVersion);
  }

  public async mapToViewTemplateDto(
    viewTemplateVersion: ViewTemplateVersion,
  ): Promise<ViewTemplateDto> {
    // clean up view tempalte with correct id properties names according to DTO
    const viewTemplateDto: ViewTemplateDto = viewTemplateVersion;
    viewTemplateDto.versionId = viewTemplateVersion.id;
    viewTemplateDto.id = viewTemplateVersion.viewTemplateId;
    delete viewTemplateVersion.viewTemplateId;

    // clean up node schema with correct id property names according to DTO
    const nodeSchemaDto: NodeSchemaDto = viewTemplateVersion.nodeSchemaVersion;
    if (viewTemplateVersion.nodeSchemaVersion) {
      nodeSchemaDto.versionId = viewTemplateVersion.nodeSchemaVersion.id;
      nodeSchemaDto.id = viewTemplateVersion.nodeSchemaVersion.nodeSchemaId;
    }

    // remove the nodeSchemaVersion from view template since we'll be replacing
    // with nodeSchemaDto
    delete viewTemplateVersion.nodeSchemaVersion;
    viewTemplateDto.nodeSchema = nodeSchemaDto;

    // get view template from S3
    if (viewTemplateVersion && viewTemplateVersion.templateUrl) {
      delete viewTemplateVersion.templateUrl; // remove from return object (dto)
      const data = await this.getViewTemplateVersionTemplate(
        viewTemplateDto.versionId,
      );
      const viewTemplateJson = JSON.parse(data.Body.toString('utf8'));
      if (viewTemplateJson.view) {
        viewTemplateDto.view = viewTemplateJson.view;
        viewTemplateDto.viewMap = viewTemplateJson.viewMap;
      } else {
        // TODO: remove this after initial development
        // was used for legacy test data
        viewTemplateDto.view = viewTemplateJson;
      }
    }
    return viewTemplateDto;
  }

  public async getViewTemplateVersionTemplate(
    viewTemplateVersionId: string,
  ): Promise<any> {
    return this.s3client
      .getObject({
        Bucket: this.bucketName,
        Key: `views/${viewTemplateVersionId}.json`,
      })
      .promise();
  }

  public async delete(
    id: string,
    organizationId: number,
    user: User,
  ): Promise<boolean> {
    await this.viewTemplateRepository.update(
      { id, organizationId },
      { isDeleted: true, modifiedBy: user },
    );
    return true;
  }

  public async create(
    viewTemplateDto: ViewTemplateDto,
  ): Promise<ViewTemplateDto> {
    let viewTemplate = new ViewTemplate();
    viewTemplate.organizationId = viewTemplateDto.organizationId;
    viewTemplate.createdBy = viewTemplateDto.createdBy;
    viewTemplate.modifiedBy = viewTemplateDto.modifiedBy;

    let viewTemplateVersion = new ViewTemplateVersion();
    viewTemplateVersion.version = 1; // first version
    viewTemplateVersion.name = viewTemplateDto.name;
    viewTemplateVersion.dataSourceType = viewTemplateDto.dataSourceType;
    viewTemplateVersion.createdBy = viewTemplateDto.createdBy;
    viewTemplateVersion.modifiedBy = viewTemplateDto.modifiedBy;

    if (viewTemplateDto.nodeSchemaVersionId) {
      viewTemplateVersion.nodeSchemaVersionId =
        viewTemplateDto.nodeSchemaVersionId;
    }

    // save in a SQL transaction
    await this.entityManager.transaction(async transactionalEntityManager => {
      viewTemplate = await transactionalEntityManager.save(viewTemplate);
      viewTemplateVersion.viewTemplateId = viewTemplate.id;
      viewTemplateVersion = await transactionalEntityManager.save(
        viewTemplateVersion,
      );
      viewTemplateVersion.viewTemplate = viewTemplate;
      if (viewTemplateDto.view) {
        // TODO: verify template schema
        const result = await this.saveViewTemplate(
          viewTemplateVersion.id,
          viewTemplateDto,
        );
        viewTemplateVersion.templateUrl = `${this.s3Info.endpoint}/${
          this.bucketName
        }/views/${viewTemplateVersion.id}.json`;
        // save the template url
        viewTemplateVersion = await transactionalEntityManager.save(
          viewTemplateVersion,
        );
      }
    });
    return await this.findVersionById(
      viewTemplateDto.organizationId,
      viewTemplateVersion.id,
    );
  }

  public async update(
    viewTemplateDto: ViewTemplateDto,
  ): Promise<ViewTemplateDto> {
    // find the node schema being updated
    const viewTemplateVersion = await this.viewTemplateVersionRepository.findOne(
      {
        where: {
          organizationId: viewTemplateDto.organizationId, // make sure its part of the organization
          id: viewTemplateDto.versionId,
        },
      },
    );
    if (!viewTemplateVersion) {
      throw new BadRequestException('View not found.');
    }
    if (viewTemplateVersion.isPublished) {
      throw new BadRequestException(
        'The current View version is published. Please create a new version.',
      );
    }
    if (viewTemplateDto.name) {
      viewTemplateVersion.name = viewTemplateDto.name;
    }
    if (viewTemplateDto.dataSourceType) {
      viewTemplateVersion.dataSourceType = viewTemplateDto.dataSourceType;
    }
    viewTemplateVersion.nodeSchemaVersionId =
      viewTemplateDto.nodeSchemaVersionId;
    // remove existing nodeSchemaVersion object so that nodeSchemaVersionId gets updated
    delete viewTemplateVersion.nodeSchemaVersion;
    viewTemplateVersion.modifiedBy = viewTemplateDto.modifiedBy;
    if (viewTemplateDto.view) {
      // TODO: verify template schema
      const result = await this.saveViewTemplate(
        viewTemplateVersion.id,
        viewTemplateDto,
      );
      viewTemplateVersion.templateUrl = `${this.s3Info.endpoint}/${
        this.bucketName
      }/views/${viewTemplateVersion.id}.json`;
    }
    await this.viewTemplateVersionRepository.save(viewTemplateVersion);
    // refetch view template
    return await this.findVersionById(
      viewTemplateDto.organizationId,
      viewTemplateDto.versionId,
    );
  }

  public async saveViewTemplate(
    viewTemplateVersionId: string,
    viewTemplateDto: ViewTemplateDto,
  ): Promise<any> {
    return this.s3client
      .putObject({
        Bucket: this.bucketName,
        Key: `views/${viewTemplateVersionId}.json`,
        Body: JSON.stringify(viewTemplateDto),
      })
      .promise();
  }
}
