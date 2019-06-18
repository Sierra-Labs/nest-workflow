import { DynamicModule, Module, Provider } from '@nestjs/common';
import { ClassProvider } from '@nestjs/common/interfaces';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { NodeSchema } from '../entities/node-schema.entity';
import { Node } from '../entities/node.entity';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { NodeDataController } from './node-data.controller';
import { NodeDataService } from './node-data.service';
import { NodeSchemaController } from './node-schema.controller';
import { NodeSchemaService } from './node-schema.service';
import { NodeController } from './node.controller';
import { NodeService } from './node.service';
import { WorkflowService } from '../workflow/workflow.service';
import { WorkflowVersion } from '../entities/workflow-version.entity';
import { Workflow } from '../entities/workflow.entity';

const defaultProviders = [
  {
    provide: 'WorkflowService',
    useClass: WorkflowService,
  },
  {
    provide: 'NodeService',
    useClass: NodeService,
  },
  {
    provide: 'NodeDataService',
    useClass: NodeDataService,
  },
  {
    provide: 'NodeSchemaService',
    useClass: NodeSchemaService,
  },
  {
    provide: 'AttributeService',
    useClass: AttributeService,
  },
  {
    provide: 'SequenceAttributeService',
    useClass: SequenceAttributeService,
  },
];
@Module({
  imports: [
    TypeOrmModule.forFeature([
      NodeSchema,
      NodeSchemaVersion,
      Node,
      Workflow,
      WorkflowVersion,
    ]),
  ],
  controllers: [NodeController, NodeSchemaController, NodeDataController],
  providers: defaultProviders,
})
export class NodeModule {
  static forRoot(providers: Provider[]): DynamicModule {
    return {
      module: NodeModule,
      providers: defaultProviders.map(
        (provider: ClassProvider) =>
          providers.find(
            (p: ClassProvider) => p && p.provide === provider.provide,
          ) || provider,
      ),
    };
  }
}
