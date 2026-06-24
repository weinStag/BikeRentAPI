import { Test, TestingModule } from '@nestjs/testing';
import { BikeImagesResolver } from 'src/bike-images/bike-images.resolver';
import { BikeImagesRepository } from 'src/bike-images/repository/bike-images.repository';

describe('BikeImagesResolver', () => {
  let resolver: BikeImagesResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BikeImagesResolver,
        { provide: BikeImagesRepository, useValue: { add: jest.fn(), find: jest.fn(), list: jest.fn(), remove: jest.fn(), update: jest.fn() } },
      ],
    }).compile();

    resolver = module.get<BikeImagesResolver>(BikeImagesResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
