import { Test, TestingModule } from '@nestjs/testing';
import { RentResolver } from 'src/rent/rent.resolver';
import { RentRepository } from 'src/rent/repository/rent.repository';
import { BikeResolver } from 'src/bike/bike.resolver';
import { UserResolver } from 'src/user/user.resolver';
import { PricingService } from 'src/rent/service/pricing.service';
import { UnavailableBikeError } from 'src/errors/unavailable-bike-error';
import { RentNotFoundError } from 'src/errors/rent-not-found-error';
import { InvalidRatingError } from 'src/errors/invalid-rating-error';
import { RentStillOpenError } from 'src/errors/rent-still-open-error';
import { RentAlreadyRatedError } from 'src/errors/rent-already-rated-error';
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

  // ═══════════════════════════════════════════════════════════════════════════
  // rateRental — Boundary Value Analysis (BVA) on the 1–5 star rating
  //
  // Valid partition  : [1, 5]
  // Invalid partition: (–∞, 1) ∪ (5, +∞)
  // Boundaries tested: 0, 0.9, 1 (min), 3 (midpoint), 5 (max), 5.1, 6
  // Guard conditions : rent not found · rent still open · already rated
  // ═══════════════════════════════════════════════════════════════════════════
  describe('rateRental', () => {
    const makeClosedRent = (ratingValue: number | null = null): Partial<RentSchema> => ({
      id: 'rent-1',
      bikeId: 'bike-1',
      userId: 'user-1',
      startDate: new Date('2024-01-03T10:00:00Z'),
      endDate: new Date('2024-01-03T12:00:00Z'),
      ratingValue,
      ratingComment: null,
      bike: makeBike(false) as BikeSchema,
    });

    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    // BVA: invalid ratings (below minimum boundary)
    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    it('BVA: rating = 0 (below min) → throws InvalidRatingError', async () => {
      await expect(resolver.rateRental('rent-1', 0, 'ok'))
        .rejects.toThrow(InvalidRatingError);
      expect(rentRepository.find).not.toHaveBeenCalled();
    });

    it('BVA: rating = 0.9 (just below min boundary) → throws InvalidRatingError', async () => {
      await expect(resolver.rateRental('rent-1', 0.9, 'ok'))
        .rejects.toThrow(InvalidRatingError);
      expect(rentRepository.find).not.toHaveBeenCalled();
    });

    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    // BVA: valid ratings (on and within boundaries)
    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    it('BVA: rating = 1 (min boundary) → succeeds', async () => {
      const rent = makeClosedRent();
      (rentRepository.find as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);

      await resolver.rateRental('rent-1', 1, 'minimum');

      expect(rent.ratingValue).toBe(1);
      expect(rentRepository.update).toHaveBeenCalledWith(rent);
    });

    it('BVA: rating = 3 (midpoint) → succeeds', async () => {
      const rent = makeClosedRent();
      (rentRepository.find as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);

      await resolver.rateRental('rent-1', 3, 'average');

      expect(rent.ratingValue).toBe(3);
    });

    it('BVA: rating = 5 (max boundary) → succeeds', async () => {
      const rent = makeClosedRent();
      (rentRepository.find as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);

      await resolver.rateRental('rent-1', 5, 'excellent');

      expect(rent.ratingValue).toBe(5);
      expect(rentRepository.update).toHaveBeenCalledWith(rent);
    });

    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    // BVA: invalid ratings (above maximum boundary)
    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    it('BVA: rating = 5.1 (just above max boundary) → throws InvalidRatingError', async () => {
      await expect(resolver.rateRental('rent-1', 5.1, 'ok'))
        .rejects.toThrow(InvalidRatingError);
    });

    it('BVA: rating = 6 (above max) → throws InvalidRatingError', async () => {
      await expect(resolver.rateRental('rent-1', 6, 'ok'))
        .rejects.toThrow(InvalidRatingError);
    });

    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    // Guard conditions (domain rules)
    // — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — — —
    it('guard: rent does not exist → throws RentNotFoundError', async () => {
      (rentRepository.find as jest.Mock).mockResolvedValue(null);

      await expect(resolver.rateRental('rent-x', 4, 'nice'))
        .rejects.toThrow(RentNotFoundError);
    });

    it('guard: rent has no endDate (still open) → throws RentStillOpenError', async () => {
      const openRent: Partial<RentSchema> = {
        id: 'rent-1',
        endDate: null,
        ratingValue: null,
      };
      (rentRepository.find as jest.Mock).mockResolvedValue(openRent);

      await expect(resolver.rateRental('rent-1', 4, 'nice'))
        .rejects.toThrow(RentStillOpenError);
    });

    it('guard: rent already has a rating → throws RentAlreadyRatedError', async () => {
      const alreadyRated = makeClosedRent(5); // ratingValue = 5
      (rentRepository.find as jest.Mock).mockResolvedValue(alreadyRated);

      await expect(resolver.rateRental('rent-1', 3, 'change'))
        .rejects.toThrow(RentAlreadyRatedError);
    });

    it('guard: saves ratingComment alongside ratingValue', async () => {
      const rent = makeClosedRent();
      (rentRepository.find as jest.Mock).mockResolvedValue(rent);
      (rentRepository.update as jest.Mock).mockResolvedValue(undefined);

      await resolver.rateRental('rent-1', 4, 'great ride!');

      expect(rent.ratingComment).toBe('great ride!');
    });
  });
});

