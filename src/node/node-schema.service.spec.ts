import { Test, TestingModule } from '@nestjs/testing';
import { NodeSchemaService } from './node-schema.service';

describe('NodeSchemaService', () => {
  let service: NodeSchemaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NodeSchemaService],
    }).compile();

    service = module.get<NodeSchemaService>(NodeSchemaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
