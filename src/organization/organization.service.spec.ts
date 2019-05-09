import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationService } from './organization.service';
import { AppModule } from '../app.module';

describe('OrganizationService', () => {
  let service: OrganizationService;
  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    service = module.get<OrganizationService>(OrganizationService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
