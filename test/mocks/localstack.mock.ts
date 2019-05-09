import * as _ from 'lodash';
import * as AWS from 'aws-sdk';
import { Logger } from '@nestjs/common';

import { TestingModule } from '@nestjs/testing';
import { ConfigService } from '@sierralabs/nest-utils';

export class LocalstackMock {
  configService: ConfigService;
  s3client: AWS.S3;
  bucketName: string;
  region: string;
  logger = new Logger('LocalstackMock');

  constructor(private readonly module: TestingModule) {
    this.configService = module.get<ConfigService>(ConfigService);
    const config = this.configService.get('aws');
    const s3Info = config.s3;
    s3Info.accessKeyId = config.accessKeyId;
    s3Info.secretAccessKey = config.secretAccessKey;
    s3Info.region = config.region;

    this.s3client = new AWS.S3(s3Info);
    this.bucketName = this.configService.get('aws.s3.bucket');
    this.region = this.configService.get('aws.region') || 'us-west-2';
  }

  async generate() {
    if (!(await this.isBucketExists())) {
      await this.createBucket();
    }
  }

  async isBucketExists() {
    const params: AWS.S3.Types.HeadBucketRequest = {
      Bucket: this.bucketName,
    };
    try {
      const exist = await this.s3client.headBucket(params).promise();
      return exist ? Promise.resolve(true) : Promise.resolve(false);
    } catch (error) {
      this.logger.log(error);
      return Promise.resolve(false);
    }
  }

  async createBucket(): Promise<AWS.S3.Types.CreateBucketOutput> {
    const params: AWS.S3.Types.CreateBucketRequest = {
      Bucket: this.bucketName,
    };
    return await this.s3client.createBucket(params).promise();
  }
}
