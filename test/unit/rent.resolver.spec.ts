import { Test, TestingModule } from '@nestjs/testing';
import { RentResolver } from 'src/rent/rent.resolver';
import { RentRepository } from 'src/rent/repository/rent.repository';
import { BikeResolver } from 'src/bike/bike.resolver';
import { UserResolver } from 'src/user/user.resolver';
import { PricingService } from 'src/rent/service/pricing.service';
import { UnavailableBikeError } from 'src/errors/unavailable-bike-error';
import { RentNotFoundError } from 'src/errors/rent-not-found-error';
import { BikeSchema } from 'src/bike/schema/bike.schema';
import { RentSchema } from 'src/rent/schema/rent.schema';

/**
 * Test suite for RentResolver
 *
 * All external dependencies (repositories and cross-resolver calls) are replaced
 * by Test Doubles (jest mocks), isolating the resolver's own business logic.
 */
describe('RentResolver', () => {
  let resolver: RentResolver;
  let rentRepository: jest.Mocked<RentRepository>;
  let bikeResolver: jest.Mocked<BikeResolver>;
  let pricingService: jest.Mocked<PricingService>;

  const makeBike = (available: boolean): Partial<BikeSchema> => ({
    id: 'bike-1',
    available,
    valuePerHour: 10,
    active: true,
  });

  const makeRent = (bike: Partial<BikeSchema>): Partial<RentSchema> => ({
    id: 'rent-1',
    bikeId: 'bike-1',
    userId: 'user-1',
    startDate: new Date('2024-01-03T10:00:00Z'),
    endDate: null,
    bike: bike as BikeSchema,
  });

  beforeEach(async () => {
    const rentRepoMock: Partial<jest.Mocked<RentRepository>> = {
      findOpen: jest.fn(),
      update: jest.fn(),
      add: jest.fn(),
      find: jest.fn(),
      list: jest.fn(),
      remove: jest.fn(),
      findOpenRentsFor: jest.fn(),
    };

    const bikeResolverMock: Partial<jest.Mocked<BikeResolver>> = {
      findBikeByID: jest.fn(),
      updateBike: jest.fn(),
    };

    const userResolverMock: Partial<jest.Mocked<UserResolver>> = {
      findUserByEmail: jest.fn(),
    };

    const pricingMock: Partial<jest.Mocked<PricingService>> = {
      calculateRentAmount: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RentResolver,
        { provide: RentRepository, useValue: rentRepoMock },
        { provide: BikeResolver, useValue: bikeResolverMock },
        { provide: UserResolver, useValue: userResolverMock },
        { provide: PricingService, useValue: pricingMock },
      ],
    }).compile();

    resolver = module.get<RentResolver>(RentResolver);
    rentRepository = module.get(RentRepository);
    bikeResolver = module.get(BikeResolver);
    pricingService = module.get(PricingService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // rentBike
  // ═══════════════════════════════════════════════════════════════════════════
  describe('rentBike', () => {
    it('should throw UnavailableBikeError when bike is not available', async () => {
      (bikeResolver.findBikeByID as jest.Mock).mockResolvedValue(makeBike(false));

      await expect(resolver.rentBike('user-1', 'bike-1', 'station-1'))
        .rejects.toThrow(UnavailableBikeError);
    });

    it('should NOT create a rent when bike is unavailable', async () => {
      (bikeResolver.findBikeByID as jest.Mock).mockResolvedValue(makeBike(false));

      await expect(resolver.rentBike('user-1', 'bike-1', 'station-1')).rejects.toThrow();
      expect(rentRepository.add).not.toHaveBeenCalled();
    });

    it('should mark bike as unavailable and persist the new rent when bike is available', async () => {
      const bike = makeBike(true);
      (bikeResolver.findBikeByID as jest.Mock).mockResolvedValue(bike);
      (bikeResolver.updateBike as jest.Mock).mockResolvedValue(undefined);
      (rentRepository.add as jest.Mock).mockResolvedValue(undefined);

      await resolver.rentBike('user-1', 'bike-1', 'station-1');

      expect(bike.available).toBe(false);
      expect(bikeResolver.updateBike).toHaveBeenCalledWith(bike);
      expect(rentRepository.add).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // returnBike
  // ═══════════════════════════════════════════════════════════════════════════
  describe('returnBike', () => {
    it('should throw RentNotFoundError when there is no open rent for the user/bike pair', async () => {
      (rentRepository.findOpen as jest.Mock).mockResolvedValue(null);

      await expect(resolver.returnBike('user-1', 'bike-1'))
        .rejects.toThrow(RentNotFoundError);
    });

    it('should mark bike as available after return', async () => {
      const bike = makeBike(false);
      const rent = makeRent(bike);
      (rentRepository.findOpen as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);
      (bikeResolver.updateBike as jest.Mock).mockResolvedValue(undefined);
      (pricingService.calculateRentAmount as jest.Mock).mockReturnValue(20);

      await resolver.returnBike('user-1', 'bike-1');

      expect(bike.available).toBe(true);
      expect(bikeResolver.updateBike).toHaveBeenCalledWith(bike);
    });

    it('should return the amount calculated by PricingService', async () => {
      const bike = makeBike(false);
      const rent = makeRent(bike);
      (rentRepository.findOpen as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);
      (bikeResolver.updateBike as jest.Mock).mockResolvedValue(undefined);
      (pricingService.calculateRentAmount as jest.Mock).mockReturnValue(42.5);

      const result = await resolver.returnBike('user-1', 'bike-1');

      expect(result).toBe(42.5);
    });

    it('should call PricingService with startDate, endDate and valuePerHour', async () => {
      const bike = makeBike(false);
      const rent = makeRent(bike);
      (rentRepository.findOpen as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);
      (bikeResolver.updateBike as jest.Mock).mockResolvedValue(undefined);
      (pricingService.calculateRentAmount as jest.Mock).mockReturnValue(20);

      await resolver.returnBike('user-1', 'bike-1');

      expect(pricingService.calculateRentAmount).toHaveBeenCalledWith(
        rent.startDate,
        expect.any(Date), // endDate set inside returnBike
        bike.valuePerHour,
      );
    });

    it('should persist the rent update before computing the price', async () => {
      const callOrder: string[] = [];
      const bike = makeBike(false);
      const rent = makeRent(bike);
      (rentRepository.findOpen as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockImplementation(() => {
        callOrder.push('update');
        return Promise.resolve();
      });
      (bikeResolver.updateBike as jest.Mock).mockResolvedValue(undefined);
      (pricingService.calculateRentAmount as jest.Mock).mockImplementation(() => {
        callOrder.push('price');
        return 20;
      });

      await resolver.returnBike('user-1', 'bike-1');

      expect(callOrder).toEqual(['update', 'price']);
    });
  });
});

