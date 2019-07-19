import { Controller, Post, Param, Body, Res } from '@nestjs/common';
import { ExportService } from './export.service';
import { ApiUseTags, ApiOperation } from '@nestjs/swagger';
import { RolesType, Roles } from '@sierralabs/nest-identity';
import { RequiredPipe } from '@sierralabs/nest-utils';

@ApiUseTags('Exports')
@Controller('exports')
export class ExportController {
  constructor(protected readonly exportService: ExportService) {}

  @Roles(RolesType.$authenticated)
  @ApiOperation({ title: 'Create a document using data and template' })
  @Post(':templatePath')
  public async export(
    @Res() response,
    @Param('templatePath', new RequiredPipe()) templatePath: string,
    @Body(new RequiredPipe()) data: any,
  ): Promise<any> {
    const documentBuffer = this.exportService.export(data, templatePath);
    response.setHeader(
      'content-type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    return response.send(documentBuffer);
  }
}
