import { Module } from '@nestjs/common';
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

@Module({
  imports: [TypeOrmModule.forFeature([NodeSchema, NodeSchemaVersion, Node])],
  controllers: [NodeController, NodeSchemaController, NodeDataController],
  providers: [
    NodeService,
    NodeDataService,
    NodeSchemaService,
    AttributeService,
    SequenceAttributeService,
    NodeDataService,
  ],
})
export class NodeModule {}
