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
  ForbiddenException,
} from '@nestjs/common';
import { Roles, RolesType, AuthService } from '@sierralabs/nest-identity';
import { ApiUseTags, ApiOperation } from '@nestjs/swagger';
import { RequiredPipe } from '@sierralabs/nest-utils';
import { FileService } from './file.service';
import { FilePresignedDto, FileCreatePresignedDto } from './file.dto';

@ApiUseTags('Files')
@Controller('files')
export class FileController {
  constructor(
    protected readonly fileService: FileService,
  ) {}

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
  @ApiOperation({ title: 'Proxy the file from S3' })
  @Get()
  public proxyFile(
    @Query('key') key: string,
    @Req() request,
    @Res() response,
    @Next() next,
  ): any {
    // const token = request.query.token;
    // if (!token) {
    //   throw new ForbiddenException('Authorization token required.');
    // }
    // try {
    //   this.authService.verifyToken(token);
    // } catch (error) {
    //   throw new ForbiddenException('Invalid authorization token.');
    // }
    return this.fileService.proxyFile(key, request, response, next);
  }
}
