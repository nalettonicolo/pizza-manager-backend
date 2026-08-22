import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  let service: PlatformService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformService, { provide: PrismaService, useValue: {} }],
    }).compile();

    service = module.get<PlatformService>(PlatformService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
