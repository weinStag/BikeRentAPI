import { Test, TestingModule } from '@nestjs/testing';
import { BikeResolver } from 'src/bike/bike.resolver';
import { BikeRepository } from 'src/bike/repository/bike.repository';
import { BikeNotFoundError } from 'src/errors/bike-not-found-error';
import { BikeSchema } from 'src/bike/schema/bike.schema';

describe('BikeResolver', () => {
  let resolver: BikeResolver;
  let bikeRepository: jest.Mocked<BikeRepository>;

  const fakeBike = (): Partial<BikeSchema> => ({
    id: 'bike-1',
    description: 'Mountain Bike',
    available: true,
    active: true,
    valuePerHour: 15,
    maxWeight: 120,
    location: 'Station A',
    modelId: 'model-1',
  });

  beforeEach(async () => {
    const bikeRepoMock: Partial<jest.Mocked<BikeRepository>> = {
      find: jest.fn(),
      add: jest.fn(),
      remove: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BikeResolver,
        { provide: BikeRepository, useValue: bikeRepoMock },
      ],
    }).compile();

    resolver = module.get<BikeResolver>(BikeResolver);
    bikeRepository = module.get(BikeRepository);
  });

  describe('findBikeByID', () => {
    it('should throw BikeNotFoundError when bike does not exist', async () => {
      (bikeRepository.find as jest.Mock).mockResolvedValue(null);

      await expect(resolver.findBikeByID('non-existent-id'))
        .rejects.toThrow(BikeNotFoundError);
    });

    it('should return the bike when it exists', async () => {
      const bike = fakeBike();
      (bikeRepository.find as jest.Mock).mockResolvedValue(bike);

      const result = await resolver.findBikeByID('bike-1');

      expect(result).toBe(bike);
    });
  });

  describe('listBikes', () => {
    it('should return all bikes from the repository', async () => {
      const bikes = [fakeBike(), { ...fakeBike(), id: 'bike-2' }];
      (bikeRepository.list as jest.Mock).mockResolvedValue(bikes);

      const result = await resolver.listBikes();

      expect(result).toHaveLength(2);
      expect(result).toBe(bikes);
    });
  });
});

