import { Test, TestingModule } from '@nestjs/testing';
import { OvhService } from './ovh.service';

describe('OvhService', () => {
  let service: OvhService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OvhService],
    }).compile();

    service = module.get<OvhService>(OvhService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
