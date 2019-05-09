import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationController } from './organization.controller';
import { AppModule } from '../app.module';

describe('Organization Controller', () => {
  let module: TestingModule;
  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });
  it('should be defined', () => {
    const controller: OrganizationController = module.get<
      OrganizationController
    >(OrganizationController);
    expect(controller).toBeDefined();
  });
});
