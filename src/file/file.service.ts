import { S3 } from 'aws-sdk';
import * as path from 'path';
import * as s3Proxy from 's3-proxy';
import { v4 as uuid } from 'uuid';
import * as mime from 'mime-types';

import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@sierralabs/nest-utils';

import { FilePresignedDto } from './file.dto';

@Injectable()
export class FileService {
  s3client: S3;
  s3Info: any;

  constructor(protected readonly configService: ConfigService) {
    const config = configService.get('aws');
    this.s3Info = config.s3;
    this.s3Info.accessKeyId = config.accessKeyId;
    this.s3Info.secretAccessKey = config.secretAccessKey;
    this.s3Info.region = config.region;
    this.s3client = new S3(this.s3Info);
  }

  public verifyMimeType(mimeType: string): boolean {
    const mimeTypes = this.configService.get('http.upload.mimeTypes');
    if (!mimeTypes) {
      return true; // all mime types allowed
    } else {
      return mimeTypes.includes(mimeType);
    }
  }

  public verifyFolderPath(folderPath: string): boolean {
    const folderPaths = this.configService.get('http.upload.folderPaths');
    if (!folderPaths) {
      return true; // all folder paths allowed
    } else {
      return folderPaths.includes(folderPath);
    }
  }

  public async createPresignedPost(
    folderPath: string,
    mimeType: string,
    expiration: number = 3600,
  ): Promise<FilePresignedDto> {
    if (!this.verifyMimeType(mimeType)) {
      throw new BadRequestException(`Unallowed mime type: ${mimeType}`);
    }
    if (!this.verifyFolderPath(folderPath)) {
      throw new BadRequestException(`Unallowed folder path: ${folderPath}`);
    }
    const fileId = uuid();
    const fileExtension = mime.extension(mimeType);
    const fileKey = fileExtension ? `${fileId}.${fileExtension}` : fileId;
    const config = this.configService.get('aws.s3');
    const baseUrl = this.configService.get('api.baseUrl');
    const params = {
      Bucket: config.bucket,
      Key: path.join(folderPath, fileKey),
      Expires: expiration,
    };
    const querystring = encodeURIComponent(params.Key);
    return {
      destinationUrl: `${baseUrl}/files?key=${querystring}`,
      signedUrl: this.s3client.getSignedUrl('putObject', params),
      expiration,
    };
  }

  public async createPresignedGet(
    fileKey: string,
    expiration: number = 3600,
  ): Promise<string> {
    const config = this.configService.get('aws.s3');
    const baseUrl = this.configService.get('api.baseUrl');
    const params = {
      Bucket: config.bucket,
      Key: fileKey,
      Expires: expiration,
    };
    return this.s3client.getSignedUrl('getObject', params);
  }

  public async proxyFile(key: string, request, response, next) {
    const extension = path.extname(key);
    switch (extension) {
      case '.mp4':
      case '.m4v':
      case '.mov':
        // video files need to be redirected for streaming
        const signedUrl = await this.createPresignedGet(key);
        response.redirect(signedUrl);
        break;
      default:
        request.originalUrl = `/${key}`;
        const options = {
          ...this.s3Info,
        };
        s3Proxy(options)(request, response, next);
    }
  }
}
