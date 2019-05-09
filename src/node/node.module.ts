import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { NodeSchemaVersion } from '../entities/node-schema-version.entity';
import { NodeSchema } from '../entities/node-schema.entity';
import { Node } from '../entities/node.entity';
import { AttributeService } from './attributes/attribute.service';
import { SequenceAttributeService } from './attributes/sequence-attribute.service';
import { NodeSchemaController } from './node-schema.controller';
import { NodeSchemaService } from './node-schema.service';
import { NodeController } from './node.controller';
import { NodeService } from './node.service';

@Module({
  imports: [TypeOrmModule.forFeature([NodeSchema, NodeSchemaVersion, Node])],
  controllers: [NodeController, NodeSchemaController],
  providers: [
    NodeService,
    NodeSchemaService,
    AttributeService,
    SequenceAttributeService,
  ],
})
export class NodeModule {}
