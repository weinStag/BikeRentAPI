import { Injectable } from '@nestjs/common';

/**
 * PricingService
 *
 * Applies proration rules when calculating the total amount charged for a bike rental.
 *
 * Rules:
 *  1. Minimum charge is always 1 full hour, regardless of how short the rental was.
 *  2. After the first hour, additional time is billed in 30-minute blocks, rounded UP.
 *     (e.g. 1h 20min → charged as 1.5h; 1h 31min → charged as 2h)
 *  3. Weekend surcharge: rentals that START on Saturday or Sunday incur a 20% surcharge.
 *  4. Long-rental discount: rentals whose prorated duration exceeds 8 hours receive a 15% discount.
 *  5. The surcharge and the discount can apply simultaneously.
 *  6. The final amount is rounded to 2 decimal places.
 */
@Injectable()
export class PricingService {
  /**
   * Rounds raw hours up to the nearest 30-minute block.
   * Returns 0 only when rawHours is 0 (no rental took place).
   * For any positive duration under 1 hour, enforces a minimum charge of 1 hour.
   */
  prorateHours(rawHours: number): number {
    if (rawHours <= 0) return 0;
    // Round up to nearest 30-minute block; Math.max enforces the 1-hour minimum.
    return Math.max(1, Math.ceil(rawHours * 2) / 2);
  }

  /**
   * Returns true when the given date falls on a Saturday (6) or Sunday (0).
   */
  isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6;
  }

  /**
   * Calculates the total rental amount applying proration, weekend surcharge and
   * long-rental discount.
   */
  calculateRentAmount(startDate: Date, endDate: Date, valuePerHour: number): number {
    const rawHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    const proratedHours = this.prorateHours(rawHours);

    let amount = proratedHours * valuePerHour;

    // Rule 3 – Weekend surcharge: +20%
    if (this.isWeekend(startDate)) {
      amount *= 1.2;
    }

    // Rule 4 – Long-rental discount: -15% when prorated duration exceeds 8 hours
    if (proratedHours > 8) {
      amount *= 0.85;
    }

    return Math.round(amount * 100) / 100;
  }
}
