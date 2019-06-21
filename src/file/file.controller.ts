import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  Query,
  Req,
  Res,
  Next,
} from '@nestjs/common';
import { Roles, RolesType } from '@sierralabs/nest-identity';
import { ApiUseTags, ApiOperation } from '@nestjs/swagger';
import { RequiredPipe } from '@sierralabs/nest-utils';
import { FileService } from './file.service';
import { FilePresignedDto, FileCreatePresignedDto } from './file.dto';

@ApiUseTags('Files')
@Controller('files')
export class FileController {
  constructor(protected readonly fileService: FileService) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Create Presigned Url for S3' })
  @Post('presign/:folderPath')
  public async createPresignedPost(
    @Param('folderPath', new RequiredPipe()) folderPath: string,
    @Body(new RequiredPipe()) createPresignedDto: FileCreatePresignedDto,
  ): Promise<FilePresignedDto> {
    return this.fileService.createPresignedPost(
      folderPath,
      createPresignedDto.mimeType,
    );
  }

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Proxy the media file from S3' })
  @Get()
  public proxyFile(
    @Query('key') key: string,
    @Req() request,
    @Res() response,
    @Next() next,
  ): any {
    return this.fileService.proxyFile(key, request, response, next);
  }
}
