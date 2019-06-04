import { Test, TestingModule } from '@nestjs/testing';
import { NodeDataController } from './node-data.controller';

xdescribe('NodeData Controller', () => {
  let controller: NodeDataController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodeDataController],
    }).compile();

    controller = module.get<NodeDataController>(NodeDataController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
