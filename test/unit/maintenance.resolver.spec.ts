import { Test, TestingModule } from '@nestjs/testing';
import { MaintenanceResolver } from 'src/maintenance/maintenance.resolver';
import { MaintenanceRepository } from 'src/maintenance/repository/maintenance.repository';

describe('MaintenanceResolver', () => {
  let resolver: MaintenanceResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MaintenanceResolver,
        { provide: MaintenanceRepository, useValue: { add: jest.fn(), find: jest.fn(), list: jest.fn(), remove: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    resolver = module.get<MaintenanceResolver>(MaintenanceResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
