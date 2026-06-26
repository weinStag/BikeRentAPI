export class InvalidRatingError extends Error {
  public readonly name = 'InvalidRatingError';
  constructor() {
    super('Rating must be between 1 and 5.');
  }
}
