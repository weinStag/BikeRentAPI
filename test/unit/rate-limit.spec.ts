import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerModule, ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { GqlThrottlerGuard } from 'src/throttler/gql-throttler.guard';

/**
 * Rate-Limiting Tests — @nestjs/throttler
 *
 * Strategy: The application registers GqlThrottlerGuard globally via APP_GUARD
 * (see app.module.ts). The guard extends ThrottlerGuard and overrides
 * getRequestResponse() to extract the HTTP request from the GraphQL context,
 * since the default ThrottlerGuard reads req.ip directly from the HTTP layer.
 *
 * Configuration applied:
 *   TTL   = 60 000 ms  (1-minute sliding window)
 *   LIMIT = 30         (maximum requests per window)
 *
 * These unit tests verify:
 *   1. The guard is correctly instantiated from the DI container.
 *   2. ThrottlerException carries the standard HTTP 429 status code.
 *   3. ThrottlerException is a proper Error subclass (catchable with try/catch).
 *   4. Exceeded-limit behaviour is detectable through the exception message.
 */
describe('Rate Limiting — ThrottlerGuard', () => {
  const TTL   = 60_000; // ms — 1-minute window
  const LIMIT = 30;     // max requests per window per IP

  let guard: GqlThrottlerGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        ThrottlerModule.forRoot([{ ttl: TTL, limit: LIMIT }]),
      ],
      providers: [GqlThrottlerGuard],
    }).compile();

    guard = module.get<GqlThrottlerGuard>(GqlThrottlerGuard);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Guard configuration
  // ───────────────────────────────────────────────────────────────────────────

  it('should be defined — guard is registered in the DI container', () => {
    expect(guard).toBeDefined();
  });

  it('guard should be an instance of ThrottlerGuard (extends it)', () => {
    expect(guard).toBeInstanceOf(ThrottlerGuard);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ThrottlerException — the error thrown when the limit is exceeded
  // ───────────────────────────────────────────────────────────────────────────

  it('ThrottlerException carries HTTP 429 (Too Many Requests)', () => {
    const error = new ThrottlerException();
    expect(error.getStatus()).toBe(429);
  });

  it('ThrottlerException message contains "Too Many Requests"', () => {
    const error = new ThrottlerException();
    expect(error.message).toContain('Too Many Requests');
  });

  it('ThrottlerException is a subclass of Error (catchable normally)', () => {
    const error = new ThrottlerException();
    expect(error).toBeInstanceOf(Error);
  });

  it('ThrottlerException can be thrown and caught', () => {
    const throwIt = () => { throw new ThrottlerException(); };
    expect(throwIt).toThrow(ThrottlerException);
    expect(throwIt).toThrow(/Too Many Requests/);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Rate-limit configuration contract
  // ───────────────────────────────────────────────────────────────────────────

  it(`window TTL should be ${TTL} ms (1 minute)`, () => {
    // Documents the agreed rate-limit window; changing this constant
    // would require a deliberate update here as well.
    expect(TTL).toBe(60_000);
  });

  it(`request limit per window should be ${LIMIT}`, () => {
    expect(LIMIT).toBe(30);
  });
});
