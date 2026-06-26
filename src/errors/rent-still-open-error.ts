export class RentStillOpenError extends Error {
  public readonly name = 'RentStillOpenError';
  constructor() {
    super('Cannot rate a rental that has not been returned yet.');
  }
}
