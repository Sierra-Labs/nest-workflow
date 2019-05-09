import { Test, TestingModule } from '@nestjs/testing';
import { NodeSchemaController } from './node-schema.controller';

describe('NodeSchema Controller', () => {
  let controller: NodeSchemaController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodeSchemaController],
    }).compile();

    controller = module.get<NodeSchemaController>(NodeSchemaController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
