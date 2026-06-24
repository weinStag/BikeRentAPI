import { Test, TestingModule } from '@nestjs/testing';
import { StationResolver } from 'src/station/station.resolver';
import { StationRepository } from 'src/station/repository/station.repository';

describe('StationResolver', () => {
  let resolver: StationResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StationResolver,
        { provide: StationRepository, useValue: { add: jest.fn(), find: jest.fn(), list: jest.fn(), remove: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    resolver = module.get<StationResolver>(StationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
