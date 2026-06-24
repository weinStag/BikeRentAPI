import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from 'src/rent/service/pricing.service';

/**
 * Test suite for PricingService
 *
 * Techniques applied:
 *  - Boundary Value Analysis (BVA) on prorateHours
 *  - Modified Condition/Decision Coverage (MCDC) on calculateRentAmount
 *    Conditions: W = isWeekend(startDate)  |  L = proratedHours > 8
 *  - Equivalence partitioning for duration ranges
 */
describe('PricingService', () => {
  let service: PricingService;

  // ─── Reference dates ─────────────────────────────────────────────────────────
  // Wednesday 2024-01-03 → weekday
  // Saturday  2024-01-06 → weekend
  const makeWeekday = (hour = 10): Date => new Date(`2024-01-03T${String(hour).padStart(2, '0')}:00:00.000Z`);
  const makeWeekend = (hour = 10): Date => new Date(`2024-01-06T${String(hour).padStart(2, '0')}:00:00.000Z`);
  const addHours = (date: Date, hours: number): Date =>
    new Date(date.getTime() + hours * 3_600_000);
  const addMinutes = (date: Date, minutes: number): Date =>
    new Date(date.getTime() + minutes * 60_000);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PricingService],
    }).compile();
    service = module.get<PricingService>(PricingService);
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // prorateHours — Boundary Value Analysis
  // ═══════════════════════════════════════════════════════════════════════════
  describe('prorateHours', () => {
    describe('Zero / negative boundary', () => {
      it('returns 0 for exactly 0 hours (no rental)', () => {
        expect(service.prorateHours(0)).toBe(0);
      });

      it('returns 0 for negative input (invalid, treated as no rental)', () => {
        expect(service.prorateHours(-0.5)).toBe(0);
      });
    });

    describe('Minimum charge boundary (< 1 hour → charged as 1 hour)', () => {
      it('charges 1h for 1 minute (lower boundary of valid rental)', () => {
        expect(service.prorateHours(1 / 60)).toBe(1);
      });

      it('charges 1h for 30 minutes (midpoint under threshold)', () => {
        expect(service.prorateHours(0.5)).toBe(1);
      });

      it('charges 1h for 59 minutes (just below 1-hour boundary)', () => {
        expect(service.prorateHours(59 / 60)).toBe(1);
      });

      it('charges 1h for exactly 1 hour (on-boundary)', () => {
        expect(service.prorateHours(1)).toBe(1);
      });
    });

    describe('30-minute block rounding (> 1 hour)', () => {
      it('rounds up to 1.5h for 1h01m (just above 1-hour boundary)', () => {
        expect(service.prorateHours(1 + 1 / 60)).toBe(1.5);
      });

      it('rounds up to 1.5h for 1h20m (midpoint of first extra block)', () => {
        expect(service.prorateHours(1 + 20 / 60)).toBe(1.5);
      });

      it('stays at 1.5h for exactly 1h30m (on 30-min block boundary)', () => {
        expect(service.prorateHours(1.5)).toBe(1.5);
      });

      it('rounds up to 2h for 1h31m (just above 1.5h boundary)', () => {
        expect(service.prorateHours(1 + 31 / 60)).toBe(2);
      });

      it('stays at 2h for exactly 2 hours (on-boundary)', () => {
        expect(service.prorateHours(2)).toBe(2);
      });

      it('rounds up to 4.5h for 4h01m', () => {
        expect(service.prorateHours(4 + 1 / 60)).toBe(4.5);
      });

      it('stays at 4.5h for exactly 4h30m', () => {
        expect(service.prorateHours(4.5)).toBe(4.5);
      });

      it('rounds up to 8.5h for 8h01m', () => {
        expect(service.prorateHours(8 + 1 / 60)).toBe(8.5);
      });

      it('stays at 8h for exactly 8h (on long-rental threshold, no rounding needed)', () => {
        expect(service.prorateHours(8)).toBe(8);
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isWeekend
  // ═══════════════════════════════════════════════════════════════════════════
  describe('isWeekend', () => {
    it('returns false for Wednesday', () => {
      expect(service.isWeekend(new Date('2024-01-03T12:00:00Z'))).toBe(false);
    });

    it('returns false for Monday', () => {
      expect(service.isWeekend(new Date('2024-01-01T12:00:00Z'))).toBe(false);
    });

    it('returns false for Friday', () => {
      expect(service.isWeekend(new Date('2024-01-05T12:00:00Z'))).toBe(false);
    });

    it('returns true for Saturday', () => {
      expect(service.isWeekend(new Date('2024-01-06T12:00:00Z'))).toBe(true);
    });

    it('returns true for Sunday', () => {
      expect(service.isWeekend(new Date('2024-01-07T12:00:00Z'))).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateRentAmount — MCDC
  //
  // Conditions:
  //   W = isWeekend(startDate)
  //   L = proratedHours > 8
  //
  // Truth table (each condition independently changes the outcome):
  //   W=F  L=F  →  base amount only
  //   W=T  L=F  →  base × 1.20        (W changed outcome)
  //   W=F  L=T  →  base × 0.85        (L changed outcome)
  //   W=T  L=T  →  base × 1.20 × 0.85 (both changed)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('calculateRentAmount — MCDC', () => {
    const RATE = 10; // R$ 10 / hour

    it('[W=F, L=F] weekday + short rental → base price, no adjustments', () => {
      const start = makeWeekday();
      const end = addHours(start, 2);
      // prorated: 2h → base = 2 × 10 = 20
      expect(service.calculateRentAmount(start, end, RATE)).toBe(20);
    });

    it('[W=T, L=F] weekend + short rental → base × 1.20 surcharge', () => {
      const start = makeWeekend();
      const end = addHours(start, 2);
      // base = 20 → 20 × 1.20 = 24
      expect(service.calculateRentAmount(start, end, RATE)).toBe(24);
    });

    it('[W=F, L=T] weekday + long rental (>8h) → base × 0.85 discount', () => {
      const start = makeWeekday();
      const end = addHours(start, 9);
      // prorated: 9h → base = 90 → 90 × 0.85 = 76.50
      expect(service.calculateRentAmount(start, end, RATE)).toBe(76.5);
    });

    it('[W=T, L=T] weekend + long rental → base × 1.20 × 0.85', () => {
      const start = makeWeekend();
      const end = addHours(start, 9);
      // base = 90 → 90 × 1.20 = 108 → 108 × 0.85 = 91.80
      expect(service.calculateRentAmount(start, end, RATE)).toBe(91.8);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateRentAmount — Long-rental threshold boundary (8 hours)
  // ═══════════════════════════════════════════════════════════════════════════
  describe('calculateRentAmount — boundary at 8-hour discount threshold', () => {
    const RATE = 10;

    it('does NOT apply discount at exactly 8 prorated hours (on-boundary, no discount)', () => {
      const start = makeWeekday();
      const end = addHours(start, 8);
      // 8h exactly → proratedHours = 8 → NOT > 8 → no discount
      expect(service.calculateRentAmount(start, end, RATE)).toBe(80);
    });

    it('applies discount at 8h01m (just above threshold — off-boundary)', () => {
      const start = makeWeekday();
      const end = addMinutes(start, 8 * 60 + 1);
      // raw = 8.0167h → prorated = 8.5h → 8.5 × 10 × 0.85 = 72.25
      expect(service.calculateRentAmount(start, end, RATE)).toBe(72.25);
    });

    it('applies discount at 8.5 prorated hours', () => {
      const start = makeWeekday();
      const end = addHours(start, 8.5);
      expect(service.calculateRentAmount(start, end, RATE)).toBe(72.25);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateRentAmount — Proration edge cases
  // ═══════════════════════════════════════════════════════════════════════════
  describe('calculateRentAmount — proration minimum charge', () => {
    const RATE = 10;

    it('charges minimum 1 hour for a 5-minute rental', () => {
      const start = makeWeekday();
      const end = addMinutes(start, 5);
      expect(service.calculateRentAmount(start, end, RATE)).toBe(10);
    });

    it('charges minimum 1 hour for a 59-minute rental', () => {
      const start = makeWeekday();
      const end = addMinutes(start, 59);
      expect(service.calculateRentAmount(start, end, RATE)).toBe(10);
    });

    it('rounds up to 1.5h for a 1h20m rental', () => {
      const start = makeWeekday();
      const end = addMinutes(start, 80);
      // prorated = 1.5h → 1.5 × 10 = 15
      expect(service.calculateRentAmount(start, end, RATE)).toBe(15);
    });

    it('rounds up to 2h for a 1h31m rental', () => {
      const start = makeWeekday();
      const end = addMinutes(start, 91);
      // prorated = 2h → 2 × 10 = 20
      expect(service.calculateRentAmount(start, end, RATE)).toBe(20);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // calculateRentAmount — Different rates
  // ═══════════════════════════════════════════════════════════════════════════
  describe('calculateRentAmount — rate scaling', () => {
    it('correctly scales with a higher hourly rate', () => {
      const start = makeWeekday();
      const end = addHours(start, 2);
      expect(service.calculateRentAmount(start, end, 25)).toBe(50);
    });

    it('applies weekend surcharge correctly with a fractional rate', () => {
      const start = makeWeekend();
      const end = addHours(start, 1);
      // 1h × 7.50 × 1.20 = 9.00
      expect(service.calculateRentAmount(start, end, 7.5)).toBe(9);
    });
  });
});
