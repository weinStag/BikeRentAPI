import { Test, TestingModule } from '@nestjs/testing';
import { StationTypeResolver } from 'src/station-type/station-type.resolver';
import { StationTypeRepository } from 'src/station-type/repository/station-type.repository';

describe('StationTypeResolver', () => {
  let resolver: StationTypeResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StationTypeResolver,
        { provide: StationTypeRepository, useValue: { add: jest.fn(), find: jest.fn(), list: jest.fn(), remove: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    resolver = module.get<StationTypeResolver>(StationTypeResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
