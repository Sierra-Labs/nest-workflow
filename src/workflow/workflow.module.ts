import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { WorkflowVersion } from '../entities/workflow-version.entity';
import { Workflow } from '../entities/workflow.entity';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

@Module({
  imports: [TypeOrmModule.forFeature([Workflow, WorkflowVersion])],
  controllers: [WorkflowController],
  providers: [WorkflowService],
})
export class WorkflowModule {}
