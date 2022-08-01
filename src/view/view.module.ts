import { Module } from '@nestjs/common';
import { ViewController } from './view.controller';
import { ViewService } from './view.service';
import { ViewTemplate } from '../entities/view-template.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ViewTemplateVersion } from '../entities/view-template-version.entity';
import { NodeModule, NodeSchemaService } from '../node';
import {
  NodeSchemaVersion,
  Node,
  Workflow,
  WorkflowVersion,
  NodeSchema,
} from '../entities';
import { NodeSchemaPermission } from '../entities/node-schema-permission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NodeSchema,
      NodeSchemaVersion,
      NodeSchemaPermission,
      Node,
      Workflow,
      WorkflowVersion,
      ViewTemplate,
      ViewTemplateVersion,
    ]),
    NodeModule,
  ],
  controllers: [ViewController],
  providers: [ViewService, NodeSchemaService],
})
export class ViewModule {}
