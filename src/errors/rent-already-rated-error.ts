export class RentAlreadyRatedError extends Error {
  public readonly name = 'RentAlreadyRatedError';
  constructor() {
    super('This rental has already been rated.');
  }
}
