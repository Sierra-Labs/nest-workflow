import { Module } from '@nestjs/common';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';
import { ViewTemplate } from '../entities/view-template.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewTemplateVersion } from '../entities/view-template-version.entity';
import { NodeModule, NodeSchemaService } from '../node';

@Module({
  imports: [
    TypeOrmModule.forFeature([ViewTemplate, ViewTemplateVersion]),
    NodeModule,
  ],
  controllers: [ViewController],
  providers: [ViewService, NodeSchemaService],
})
export class ViewModule {}
