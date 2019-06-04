import { Test, TestingModule } from '@nestjs/testing';
import { NodeDataService } from './node-data.service';

xdescribe('NodeDataService', () => {
  let service: NodeDataService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NodeDataService],
    }).compile();

    service = module.get<NodeDataService>(NodeDataService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
